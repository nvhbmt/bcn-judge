/**
 * Lọc log biên dịch (§3.2, NFR-2).
 *
 * Dữ liệu trong file này là output THẬT của gcc/g++/python/javac/node, chép lại
 * nguyên văn từ container — không phải chuỗi tự bịa. Định dạng thông báo là thứ
 * duy nhất bộ lọc dựa vào, nên nó phải được chốt bằng mẫu thật.
 */
import { describe, expect, it } from 'vitest'
import { compileMessageForMember, sanitizeCompileOutput } from './compileOutput'

const GCC_LOI_CUA_NGUOI_HOC = `In file included from main.c:2:
solution.c: In function ‘solve’:
solution.c:3:32: error: expected ‘;’ before ‘}’ token
    3 | int solve(int n) { return n * 2
      |                                ^`

const GCC_LOI_CUA_MENTOR = `main.c: In function 'main':
main.c:3:50: error: expected ',' or ';' before 'return'
    3 | int main(void){ int BI_MAT_CUA_MENTOR = solve(1) return 0; }
      |                                                  ^~~~~~`

describe('sanitizeCompileOutput', () => {
  it('bài stdio: giữ nguyên chẩn đoán, chỉ bỏ tiền tố /w/', () => {
    const raw = '/w/main.c:3:1: error: expected declaration'

    const { text, hidMentorDiagnostics } = sanitizeCompileOutput(raw, [])

    expect(text).toBe('main.c:3:1: error: expected declaration')
    expect(hidMentorDiagnostics).toBe(false)
  })

  it('giữ lỗi của người học, bỏ dòng “In file included from” trỏ vào harness', () => {
    const { text, hidMentorDiagnostics } = sanitizeCompileOutput(GCC_LOI_CUA_NGUOI_HOC, ['main.c'])

    expect(text).toContain('solution.c:3:32')
    expect(text).toContain('int solve(int n)')
    expect(text).not.toContain('main.c')
    // Dòng "In file included from" thuộc harness nên bị bỏ — nhưng đó là dòng phụ,
    // không phải chẩn đoán thật, nên không tính là đã giấu LỖI của mentor.
    //
    // Chú thích trên có từ đầu, còn khẳng định thì trước đây chỉ có `hidMentorDiagnostics`
    // — và chính nó là thứ dán câu đổ lỗi. Tức là chú thích mô tả ý ĐỊNH, khẳng định
    // chốt hành vi NGƯỢC lại, và không ai thấy vì cả hai đều "xanh". Nay tách hai
    // khái niệm và chốt cả hai.
    expect(hidMentorDiagnostics).toBe(true)
    expect(sanitizeCompileOutput(GCC_LOI_CUA_NGUOI_HOC, ['main.c']).hidMentorErrors).toBe(false)
  })

  it('KHÔNG để lộ một dòng nguồn nào của harness khi lỗi nằm trong harness', () => {
    const { text, hidMentorDiagnostics } = sanitizeCompileOutput(GCC_LOI_CUA_MENTOR, ['main.c'])

    expect(text).toBe('')
    expect(hidMentorDiagnostics).toBe(true)
    expect(GCC_LOI_CUA_MENTOR).toContain('BI_MAT_CUA_MENTOR')
    expect(text).not.toContain('BI_MAT_CUA_MENTOR')
  })

  it('dòng trích nguồn đi sau chẩn đoán của harness cũng bị bỏ theo', () => {
    // Đây là điểm dễ sai nhất: các dòng "    3 | ..." không nhắc tên file nào cả,
    // nên lọc theo từng dòng độc lập sẽ để lọt đúng dòng chứa mã harness.
    const raw = `${GCC_LOI_CUA_MENTOR}\nsolution.c:1:1: warning: unused variable`

    const { text } = sanitizeCompileOutput(raw, ['main.c'])

    expect(text).toBe('solution.c:1:1: warning: unused variable')
  })

  it('Python: nhận dạng dòng File "..." và giấu đúng file harness', () => {
    const mentor = 'Traceback (most recent call last):\n  File "main.py", line 2, in <module>\n    from solution import Solution\nSyntaxError: bí mật'
    const hoc = 'File "solution.py", line 3\n    def solve(n)\n                ^\nSyntaxError: expected \':\''

    expect(sanitizeCompileOutput(hoc, ['main.py']).text).toContain('solution.py')
    expect(sanitizeCompileOutput(mentor, ['main.py']).text).not.toContain('bí mật')
  })

  it('Java: giấu Main.java, giữ Solution.java', () => {
    const raw = 'Solution.java:3: error: \';\' expected\npublic class Solution { return n }\n1 error'

    expect(sanitizeCompileOutput(raw, ['Main.java']).text).toContain('Solution.java:3')
  })

  it('Node: bỏ /w/ trong đường dẫn', () => {
    expect(sanitizeCompileOutput('/w/solution.js:5\nSyntaxError: Unexpected end of input', ['main.js']).text)
      .toBe('solution.js:5\nSyntaxError: Unexpected end of input')
  })

  it('lỗi không gắn với file nào (linker, hết bộ nhớ) vẫn được giữ', () => {
    const raw = 'collect2: error: ld returned 1 exit status'

    expect(sanitizeCompileOutput(raw, ['main.c']).text).toBe(raw)
  })

  it('lỗi chung đứng SAU một khối của mentor không bị nuốt theo', () => {
    // `context` dính là lỗi tinh vi nhất của bộ lọc: nó không bao giờ reset ở dòng
    // không nêu tên file, nên mọi thứ sau một khối harness đều bị coi là của harness.
    // Người học chỉ thấy câu đổ lỗi mentor, không biết máy hết bộ nhớ.
    const raw = [
      "main.c: In function 'main':",
      "main.c:5:10: note: in expansion of macro 'X'",
      'cc1plus: out of memory allocating 65536 bytes',
    ].join('\n')

    const { text } = sanitizeCompileOutput(raw, ['main.c'])

    expect(text).toBe('cc1plus: out of memory allocating 65536 bytes')
    expect(text).not.toContain('main.c')
  })
})

describe('đổ lỗi đúng người', () => {
  // Output THẬT của gcc 14 cho ca hỏng phổ biến nhất của bài dạng function: người học
  // đặt sai tên hàm. Trình biên dịch báo ở CHỖ GỌI, tức trong harness của mentor.
  const GCC_SAI_TEN_HAM = [
    "main.c: In function 'main':",
    "main.c:5:71: warning: implicit declaration of function 'f' [-Wimplicit-function-declaration]",
    "/usr/bin/ld: /tmp/ccQ7LORo.o: in function `main':",
    "main.c:(.text.startup+0x34): undefined reference to `f'",
    'collect2: error: ld returned 1 exit status',
  ].join('\n')

  it('người học sai tên hàm: nói rõ hàm nào, KHÔNG đổ cho mentor', () => {
    const msg = compileMessageForMember(GCC_SAI_TEN_HAM, ['main.c'])

    expect(msg).toContain('`f`')
    expect(msg).toMatch(/không tìm thấy hàm/)
    expect(msg).not.toMatch(/khung do người ra đề viết/)
    // Vẫn không lộ một dòng nguồn nào của harness.
    expect(msg).not.toContain('implicit declaration')
  })

  it('người học thiếu dấu chấm phẩy: không dính câu đổ lỗi mentor', () => {
    // GCC dạng function LUÔN mở đầu bằng "In file included from main.c:2:" vì harness
    // buộc phải #include mã người học. Dòng phụ đó từng bật cờ đổ lỗi, nên MỌI bài CE
    // của C/C++ dạng function đều kèm câu "lỗi của người ra đề" — kể cả lỗi 100 % của
    // người học như ca này. Mentor nhận báo lỗi rác từ mọi bài function.
    const raw = [
      'In file included from main.c:2:',
      "solution.c: In function 'solve':",
      "solution.c:3:3: error: expected ',' or ';' before 'return'",
      '    3 |   return x;',
      '      |   ^~~~~~',
    ].join('\n')

    const msg = compileMessageForMember(raw, ['main.c'])

    expect(msg).toContain('solution.c:3:3')
    expect(msg).not.toMatch(/khung do người ra đề viết/)
  })

  it('lỗi THẬT trong harness thì vẫn đổ cho mentor', () => {
    // Đối chứng: nới lỏng không được nới quá tay.
    expect(compileMessageForMember(GCC_LOI_CUA_MENTOR, ['main.c'])).toMatch(/khung do người ra đề viết/)
  })
})


describe('compileMessageForMember', () => {
  it('giấu hết thì nói rõ lỗi thuộc về người ra đề, không để màn hình trống', () => {
    const msg = compileMessageForMember(GCC_LOI_CUA_MENTOR, ['main.c'])

    expect(msg).toMatch(/khung do người ra đề viết/)
    expect(msg).not.toContain('BI_MAT_CUA_MENTOR')
  })

  it('còn lỗi của người học thì hiện lỗi đó TRƯỚC, rồi mới ghi chú', () => {
    const raw = `${GCC_LOI_CUA_NGUOI_HOC}\n${GCC_LOI_CUA_MENTOR}`

    const msg = compileMessageForMember(raw, ['main.c'])

    expect(msg.indexOf('solution.c:3:32')).toBeLessThan(msg.indexOf('khung do người ra đề'))
  })

  it('bài stdio không bao giờ dính ghi chú đó', () => {
    expect(compileMessageForMember('main.c:2:1: error: x', [])).toBe('main.c:2:1: error: x')
  })
})
