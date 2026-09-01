/**
 * So output thực với đáp án đúng, để chỉ ra ĐÚNG CHỖ lệch chứ không chỉ báo "sai".
 *
 * Vì sao tự viết thay vì kéo một thư viện diff: thứ người học cần ở đây không phải diff
 * kiểu Git (khối nào thêm, khối nào bớt), mà là "dòng mấy, ký tự thứ mấy thì khác" —
 * hai output của cùng một chương trình gần như luôn thẳng hàng theo dòng. Ghép cặp theo
 * chỉ số dòng đọc dễ hơn hẳn LCS, vốn hay trượt cả khối khi chỉ sai một con số.
 *
 * Phần đáng giá nhất là `whitespaceOnly` / `trailingNewlineOnly`. Nguyên nhân WA phổ
 * biến nhất của người mới là thừa dấu cách cuối dòng, dòng trống dư, hoặc CRLF — tô
 * sáng hai dòng TRÔNG HỆT NHAU mà không nói gì thì người học chỉ càng rối. Bắt được
 * ca đó rồi nói thẳng ra là công dụng chính của cả module này.
 */

/** Trần dòng dựng ra DOM. Output dài hơn thì phần đuôi gần như không ai đọc tới. */
const MAX_LINES = 200

const WS = /\s/g

export interface DiffLine {
  /** Số dòng, đếm từ 1. */
  n: number
  /** `null` = phía này thiếu hẳn dòng đó. */
  got: string | null
  want: string | null
  /** Khoảng `[đầu, cuối)` lệch bên trong dòng; `null` khi hai dòng giống hệt. */
  gotSpan: [number, number] | null
  wantSpan: [number, number] | null
  /** Hai dòng chỉ khác nhau ở khoảng trắng — mắt thường nhìn không ra. */
  whitespaceOnly: boolean
}

export interface OutputDiff {
  lines: DiffLine[]
  /** Dòng đầu tiên lệch; `null` khi mọi dòng đều khớp. */
  firstDiff: number | null
  /** Mọi khác biệt đều nằm ở khoảng trắng. */
  whitespaceOnly: boolean
  /** Từng dòng đều khớp, chỉ lệch ở ký tự xuống dòng cuối cùng. */
  trailingNewlineOnly: boolean
  /** Số dòng bị cắt vì vượt `MAX_LINES`. */
  hiddenLines: number
}

/**
 * `'15\n'` và `'15'` là cùng một output một dòng, nên bỏ phần tử rỗng do ký tự xuống
 * dòng cuối sinh ra. Không bỏ thì MỌI output đúng chuẩn đều hiện dư một dòng trống, và
 * dòng trống đó lại là thứ duy nhất được tô sáng — đúng kiểu chỉ dẫn sai đường.
 */
export function splitLines(s: string): string[] {
  const lines = s.split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/**
 * Chuẩn hoá y HỆT máy chấm trước khi so (xem `server/src/judge/compare.ts`).
 *
 * Bắt buộc phải trùng luật, nếu không bảng diff sẽ chỉ vào chỗ mà máy chấm cố tình bỏ
 * qua. Ca thật: bài để `trim` (mặc định), người học in thừa dấu cách cuối MỌI dòng và
 * sai số ở dòng 5 — diff không chuẩn hoá sẽ báo "khác từ dòng 1" và đẩy họ đi soi đúng
 * dòng không có lỗi.
 *
 * Mọi chế độ đều đưa CRLF/CR về LF (FR-D5 v0.5: output sinh trên Windows không bị tính
 * là WA). Riêng `trim` — và `float`, vốn cũng dựng trên `trimLines` — còn rstrip từng
 * dòng và bỏ các dòng trống ở cuối.
 */
export function normalize(text: string, mode: string): string {
  const lf = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (mode === 'exact') return lf

  const lines = lf.split('\n').map((line) => line.replace(/[ \t\f\v]+$/, ''))
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.join('\n')
}

/** Cắt bỏ phần đầu và phần đuôi giống nhau, còn lại là khoảng thật sự lệch. */
function spans(a: string, b: string): { a: [number, number]; b: [number, number] } {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  let ja = a.length
  let jb = b.length
  while (ja > i && jb > i && a[ja - 1] === b[jb - 1]) {
    ja--
    jb--
  }
  return { a: [i, ja], b: [i, jb] }
}

export function diffOutput(gotRaw: string, wantRaw: string, mode = 'trim'): OutputDiff {
  const gotNorm = normalize(gotRaw, mode)
  const wantNorm = normalize(wantRaw, mode)
  const got = splitLines(gotNorm)
  const want = splitLines(wantNorm)
  const total = Math.max(got.length, want.length)
  const shown = Math.min(total, MAX_LINES)

  const lines: DiffLine[] = []
  let firstDiff: number | null = null
  let allWhitespace = true

  for (let i = 0; i < total; i++) {
    const g = i < got.length ? (got[i] ?? '') : null
    const w = i < want.length ? (want[i] ?? '') : null

    if (g === w) {
      if (i < shown) lines.push({ n: i + 1, got: g, want: w, gotSpan: null, wantSpan: null, whitespaceOnly: false })
      continue
    }

    if (firstDiff === null) firstDiff = i + 1
    // Thiếu hẳn một dòng TRỐNG vẫn là chuyện khoảng trắng, nên so trên chuỗi đã bỏ
    // khoảng trắng của cả hai phía, coi dòng thiếu như chuỗi rỗng.
    const whitespaceOnly = (g ?? '').replace(WS, '') === (w ?? '').replace(WS, '')
    if (!whitespaceOnly) allWhitespace = false

    if (i < shown) {
      const sp = g !== null && w !== null ? spans(g, w) : null
      lines.push({ n: i + 1, got: g, want: w, gotSpan: sp?.a ?? null, wantSpan: sp?.b ?? null, whitespaceOnly })
    }
  }

  return {
    lines,
    firstDiff,
    whitespaceOnly: firstDiff !== null && allWhitespace,
    trailingNewlineOnly: firstDiff === null && gotNorm !== wantNorm,
    hiddenLines: total - shown,
  }
}

/**
 * Hiện khoảng trắng thành ký tự nhìn được. Chỉ dùng TRONG khoảng đã tô: bật lên toàn
 * dòng thì mọi output có dấu cách đều thành một dãy ký hiệu, đọc còn khó hơn.
 */
export function showWhitespace(s: string): string {
  return s.replace(/ /g, '␣').replace(/\t/g, '→').replace(/\r/g, '␍')
}
