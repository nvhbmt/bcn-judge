/**
 * Kiểm phần so output — thứ quyết định người học nhìn thấy CHỖ NÀO là sai.
 *
 * Nhóm ca đáng giá nhất ở đây là "khác mà nhìn không ra": thừa dấu cách, CRLF, thiếu
 * ký tự xuống dòng cuối. Tô sai chỗ ở những ca đó còn tệ hơn không tô, vì nó chỉ người
 * học đi soi đúng đoạn không có lỗi.
 */
import { describe, expect, it } from 'vitest'
import { diffOutput, showWhitespace, splitLines } from '@/pages/workspace/diff'

describe('splitLines', () => {
  it("'15\\n' và '15' là cùng một output một dòng", () => {
    expect(splitLines('15\n')).toEqual(['15'])
    expect(splitLines('15')).toEqual(['15'])
  })

  it('dòng trống ở giữa và dòng trống dư ở cuối vẫn được giữ', () => {
    expect(splitLines('a\n\nb\n')).toEqual(['a', '', 'b'])
    expect(splitLines('a\n\n')).toEqual(['a', ''])
  })
})

describe('diffOutput — chỉ ra đúng khoảng lệch', () => {
  it('giống hệt thì không có dòng nào lệch', () => {
    const d = diffOutput('1\n2\n', '1\n2\n')
    expect(d.firstDiff).toBeNull()
    expect(d.trailingNewlineOnly).toBe(false)
    expect(d.lines.every((l) => l.gotSpan === null)).toBe(true)
  })

  it('khoanh đúng khoảng giữa, bỏ phần đầu và đuôi giống nhau', () => {
    const d = diffOutput('abc XYZ def', 'abc Q def')
    expect(d.firstDiff).toBe(1)
    const l = d.lines[0]!
    expect(l.got!.slice(...l.gotSpan!)).toBe('XYZ')
    expect(l.want!.slice(...l.wantSpan!)).toBe('Q')
  })

  it('chỉ dòng lệch mới được đánh dấu, dòng khớp thì không', () => {
    const d = diffOutput('1\n99\n3\n', '1\n2\n3\n')
    expect(d.firstDiff).toBe(2)
    expect(d.lines.map((l) => l.gotSpan !== null)).toEqual([false, true, false])
  })

  it('thiếu hẳn dòng thì phía đó là null, không phải chuỗi rỗng', () => {
    const d = diffOutput('1\n', '1\n2\n')
    expect(d.lines[1]).toMatchObject({ n: 2, got: null, want: '2' })
    expect(d.whitespaceOnly).toBe(false)
  })
})

describe('diffOutput — chuẩn hoá đúng luật của máy chấm', () => {
  // Diff phải bỏ qua đúng những gì `server/src/judge/compare.ts` bỏ qua. Lệch luật ở
  // đây là chỉ người học đi soi một dòng mà máy chấm coi là đúng.
  it("chế độ 'trim' rstrip từng dòng, y như máy chấm", () => {
    expect(diffOutput('15   \n', '15\n', 'trim').firstDiff).toBeNull()
  })

  it("chế độ 'trim' bỏ dòng trống ở cuối", () => {
    expect(diffOutput('15\n\n\n', '15\n', 'trim').firstDiff).toBeNull()
  })

  it("chế độ 'exact' thì đúng những thứ đó lại là WA thật", () => {
    expect(diffOutput('15   \n', '15\n', 'exact').whitespaceOnly).toBe(true)
    expect(diffOutput('15\n\n', '15\n', 'exact').whitespaceOnly).toBe(true)
  })

  it('CRLF không bao giờ là khác biệt: mọi chế độ đều đưa về LF trước (FR-D5)', () => {
    expect(diffOutput('15\r\n', '15\n', 'exact').firstDiff).toBeNull()
    expect(diffOutput('15\r\n', '15\n', 'trim').firstDiff).toBeNull()
  })

  it("chế độ 'trim' chỉ vào dòng sai THẬT, không vào dòng thừa khoảng trắng", () => {
    const d = diffOutput('15   \n9\n', '15\n7\n', 'trim')
    expect(d.firstDiff).toBe(2)
    expect(d.whitespaceOnly).toBe(false)
  })

  it('mặc định là trim — cùng mặc định với cột compare_mode của bài', () => {
    expect(diffOutput('15   \n', '15\n').firstDiff).toBeNull()
  })
})

describe('diffOutput — những khác biệt mắt thường không thấy', () => {
  it('thừa dấu cách cuối dòng: báo là chuyện khoảng trắng', () => {
    const d = diffOutput('15 \n', '15\n', 'exact')
    expect(d.firstDiff).toBe(1)
    expect(d.whitespaceOnly).toBe(true)
    const l = d.lines[0]!
    // Khoảng lệch bên mình đúng là dấu cách thừa; bên đáp án rỗng.
    expect(l.got!.slice(...l.gotSpan!)).toBe(' ')
    expect(l.wantSpan![0]).toBe(l.wantSpan![1])
  })

  it('dòng trống dư ở cuối vẫn là chuyện khoảng trắng', () => {
    const d = diffOutput('15\n\n', '15\n', 'exact')
    expect(d.firstDiff).toBe(2)
    expect(d.whitespaceOnly).toBe(true)
  })

  it('thiếu mỗi ký tự xuống dòng cuối: từng dòng đều khớp, nên phải nói riêng ra', () => {
    const d = diffOutput('15', '15\n', 'exact')
    expect(d.firstDiff).toBeNull()
    expect(d.trailingNewlineOnly).toBe(true)
  })

  it('sai số thật thì KHÔNG được gắn nhãn khoảng trắng', () => {
    const d = diffOutput('16\n', '15\n', 'exact')
    expect(d.whitespaceOnly).toBe(false)
  })
})

describe('diffOutput — output dài', () => {
  it('cắt ở 200 dòng và nói còn bao nhiêu dòng nữa', () => {
    const d = diffOutput(Array.from({ length: 500 }, (_, i) => i).join('\n'), '0\n')
    expect(d.lines).toHaveLength(200)
    expect(d.hiddenLines).toBe(300)
  })
})

describe('showWhitespace', () => {
  it('hiện dấu cách, tab và CR thành ký hiệu nhìn được', () => {
    expect(showWhitespace(' \t\r')).toBe('␣→␍')
  })
})
