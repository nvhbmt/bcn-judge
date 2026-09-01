/**
 * Lọc log biên dịch trước khi trả cho người học (§3.2, NFR-2).
 *
 * Hai việc, và việc thứ hai mới là việc quan trọng:
 *
 *  1. Bỏ tiền tố `/w/` — đường dẫn bên trong container không có nghĩa gì với người
 *     học, chỉ làm thông báo khó đọc.
 *  2. **Giấu mọi chẩn đoán thuộc file của mentor.** Ở bài dạng function, harness do
 *     mentor viết được biên dịch chung với mã người học. Trình biên dịch khi báo
 *     lỗi sẽ IN LẠI DÒNG NGUỒN gây lỗi — nên một lỗi trong harness đẩy thẳng mã
 *     harness ra cho member. Đó là rò dữ liệu mentor qua đúng cái đường mà không
 *     ai nghĩ tới, và kèm theo là đổ oan: người học tưởng mình sai.
 *
 * Cách lọc: trình biên dịch nào cũng mở đầu một khối chẩn đoán bằng dòng có
 * `tên_file:số_dòng`, rồi các dòng phụ (mũi tên, trích nguồn) không nhắc tên file
 * nữa. Vì vậy bám theo "file đang được nói tới": dòng nào nêu tên file thì đổi ngữ
 * cảnh, dòng nào không nêu thì thuộc về khối trước đó.
 */

const EXT = 'c|cc|cpp|cxx|h|hpp|py|java|js|mjs|cjs'

/** Nhận tên file trong một dòng chẩn đoán, phủ cả 5 trình biên dịch đang dùng. */
function fileMentionedIn(line: string): string | null {
  // Python: File "solution.py", line 3
  const py = /File "([^"]+)"/.exec(line)
  if (py?.[1]) return basename(py[1])
  // GCC/G++/javac/node: [đường dẫn/]tên.ext:123 — cũng khớp "In file included from x.c:2:"
  const generic = new RegExp(`(^|[\\s(])([\\w./+-]+\\.(?:${EXT})):\\d+`).exec(line)
  if (generic?.[2]) return basename(generic[2])
  // Dòng tiêu đề ngữ cảnh của GCC KHÔNG có số dòng: `main.c: In function 'main':`.
  // Bỏ sót nó là bỏ sót cả khối lỗi phía sau, kể cả dòng trích mã harness.
  const header = new RegExp(`^([\\w./+-]+\\.(?:${EXT})):`).exec(line)
  if (header?.[1]) return basename(header[1])
  const included = /included from ([\w./+-]+\.\w+)/.exec(line)
  if (included?.[1]) return basename(included[1])
  return null
}

function basename(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

export interface SanitizeResult {
  text: string
  /** true khi đã bỏ ít nhất một DÒNG thuộc file của mentor — kể cả dòng phụ. */
  hidMentorDiagnostics: boolean
  /** true khi dòng bị bỏ có `error:` thật. CHỈ khi đó mới được nói "lỗi của mentor". */
  hidMentorErrors: boolean
  /** Giải thích cụ thể suy ra từ chẩn đoán đã giấu, không lộ một byte harness nào. */
  hint: string | null
}

/**
 * Dòng mở đầu một khối chẩn đoán ĐỘC LẬP, không thuộc file nào. Gặp nó thì ngữ cảnh
 * phải reset về null, nếu không lỗi chung sẽ bị nuốt theo khối của mentor ngay trước.
 * Đo được: `cc1plus: out of memory` và `collect2: error: ld returned 1 exit status`
 * đứng sau một khối lỗi trong harness đều biến mất, và người học chỉ còn thấy câu
 * đổ lỗi mentor — không biết là máy hết bộ nhớ.
 */
const DONG_DOC_LAP = /^(cc1|cc1plus|collect2|lto1|as|ld|\/usr\/bin\/ld|make|javac|\d+ (?:error|warning)s?\b)/

/** Chỉ `error:` mới là lỗi thật; `note:`/`warning:` là dòng phụ đi kèm. */
const LA_LOI = /\b(?:error|fatal error):/

/**
 * Chẩn đoán bị giấu vẫn nói được điều gì đó CÓ ÍCH mà không lộ harness: tên hàm mà
 * đề yêu cầu người học viết vốn nằm sẵn trong đề bài, không phải bí mật.
 *
 * Đây là ca hỏng phổ biến nhất của bài dạng function — người học đặt sai tên hàm hoặc
 * sai chữ ký. Trình biên dịch báo lỗi ở CHỖ GỌI, tức trong harness, nên toàn bộ chẩn
 * đoán thuộc file mentor và bản trước trả về đúng một câu "lỗi của người ra đề". Người
 * học đi báo mentor, mentor đi tìm một lỗi không tồn tại.
 */
const CHU_KY: { re: RegExp; ten: (m: RegExpExecArray) => string }[] = [
  { re: /undefined reference to [`'"]([A-Za-z_]\w*)/, ten: (m) => m[1]! },
  { re: /implicit declaration of function [`'"\u2018]([A-Za-z_]\w*)/, ten: (m) => m[1]! },
  { re: /symbol:\s+method\s+([A-Za-z_]\w*)/, ten: (m) => m[1]! },
]

function hintChoHam(ten: string): string {
  return (
    `Trình biên dịch không tìm thấy hàm \`${ten}\` mà đề yêu cầu bạn viết. ` +
    'Kiểm tra lại tên hàm, số tham số và kiểu trả về cho khớp mô tả trong đề.'
  )
}

/**
 * @param mentorFiles Tên file KHÔNG do người học viết (harness). Rỗng ở bài stdio.
 */
export function sanitizeCompileOutput(raw: string, mentorFiles: string[]): SanitizeResult {
  const hidden = new Set(mentorFiles.map(basename))
  const kept: string[] = []
  let hidMentorDiagnostics = false
  let hidMentorErrors = false
  let hint: string | null = null
  // null = chưa biết thuộc file nào; giữ lại, vì có thể là lỗi chung (hết bộ nhớ,
  // linker không tìm thấy symbol) mà người học vẫn cần thấy.
  let context: string | null = null

  for (const line of raw.split('\n')) {
    // Reset TRƯỚC khi đọc tên file: dòng độc lập có thể vẫn nhắc tên file của mentor
    // (`/usr/bin/ld: ... main.c:(.text+0x34): undefined reference to 'f'`), nhưng nó
    // mở một khối mới chứ không thuộc khối cũ.
    if (line.trim() === '' || DONG_DOC_LAP.test(line)) context = null

    const mentioned = fileMentionedIn(line)
    if (mentioned) context = mentioned

    if (context !== null && hidden.has(context)) {
      hidMentorDiagnostics = true
      if (LA_LOI.test(line)) hidMentorErrors = true
      if (!hint) {
        for (const { re, ten } of CHU_KY) {
          const m = re.exec(line)
          if (m) {
            hint = hintChoHam(ten(m))
            break
          }
        }
      }
      continue
    }
    kept.push(line.replaceAll('/w/', ''))
  }

  return {
    text: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    hidMentorDiagnostics,
    hidMentorErrors,
    hint,
  }
}

const MENTOR_FAULT =
  'Lỗi nằm ở phần khung do người ra đề viết, không phải ở bài của bạn. Hãy báo lại cho mentor.'

/**
 * Ghép thông điệp cuối cùng cho người học.
 *
 * Ba nhánh, theo thứ tự hữu ích giảm dần. Bản trước chỉ có một: hễ giấu bất kỳ dòng
 * nào của mentor là dán câu đổ lỗi — mà ở C/C++ dạng function, harness BUỘC phải
 * `#include "solution.c"` nên GCC luôn mở đầu bằng `In file included from main.c:2:`.
 * Hệ quả: MỌI bài CE, kể cả thiếu dấu chấm phẩy hoàn toàn của người học, đều kèm câu
 * "lỗi của người ra đề" — và mentor nhận báo lỗi rác từ mọi bài function.
 */
export function compileMessageForMember(raw: string, mentorFiles: string[]): string {
  const { text, hidMentorErrors, hint } = sanitizeCompileOutput(raw, mentorFiles)
  // 1. Giải thích được cụ thể thì luôn hơn: nói đúng việc người học cần sửa.
  if (hint) return text.length === 0 ? hint : `${text}\n\n${hint}`
  // 2. Giấu một `error:` thật của mentor mà không giải thích nổi — đổ lỗi đúng chỗ.
  if (hidMentorErrors) return text.length === 0 ? MENTOR_FAULT : `${text}\n\n${MENTOR_FAULT}`
  // 3. Chỉ giấu dòng phụ (`In file included from`) — không nói gì thêm.
  return text
}
