/**
 * Bảng so output cho testcase MẪU sai (kiểu LeetCode): input, output của bạn, đáp án
 * đúng — đặt cạnh nhau theo dòng, tô đúng khoảng ký tự lệch.
 *
 * Trước đây chỗ này chỉ in một dòng "Output của bạn: …" rồi thêm "Khác từ dòng 3".
 * Với output vài chục dòng thì đó là bảo người học tự dò bằng mắt, mà cái sai hay gặp
 * nhất lại vô hình: thừa một dấu cách cuối dòng. Nên khoảng lệch được tô, và riêng
 * trong khoảng đó khoảng trắng hiện thành ký hiệu nhìn thấy được.
 *
 * Đáp án đúng lấy từ `problem.samples` chứ KHÔNG phải từ kết quả chấm: serializer bài
 * nộp cấm hẳn trường `expected` (`expected?: never`) để đáp án test ẩn không bao giờ rời
 * máy chủ. Testcase mẫu thì vốn đã in trong đề, nên ghép theo `position` ở phía client
 * là đủ mà không phải nới lỏng cái cổng đó.
 */
import { diffOutput, showWhitespace, type DiffLine } from './diff'

const GRID = '2.25rem 1fr 1fr'

export function OutputDiff({
  position,
  input,
  got,
  want,
  compareMode,
  gotLabel = 'output của bạn',
  wantLabel = 'đáp án đúng',
}: {
  position: number
  input: string | null
  got: string
  want: string
  /** Luật so của bài — diff phải chuẩn hoá y hệt máy chấm, xem `normalize` trong diff.ts. */
  compareMode: string
  /**
   * Nhãn hai cột. Mặc định là lời của MEMBER; khung kiểm của mentor đổi lại, vì ở đó
   * cột trái là output của LỜI GIẢI MẪU còn cột phải là expected trong bộ test —
   * gọi nó "đáp án đúng" thì ngược hẳn ý: mentor mở bảng này chính vì nghi cột phải sai.
   */
  gotLabel?: string
  wantLabel?: string
}) {
  const d = diffOutput(got, want, compareMode)

  return (
    // Có tên hẳn hoi: khi một lượt chạy sai nhiều testcase thì trên màn hình có nhiều
    // bảng giống hệt nhau, và "bảng của test nào" là thứ duy nhất phân biệt chúng —
    // với người dùng trình đọc màn hình cũng như với test tự động.
    <div role="group" aria-label={`So output testcase mẫu #${position}`} className="border border-line bg-surface-2">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-2.5 py-1.5">
        <span className="font-mono text-[11px] text-[var(--color-wa)]">
          {d.firstDiff !== null
            ? `khác từ dòng ${d.firstDiff}`
            : d.trailingNewlineOnly
              ? 'khác ở phần kết thúc'
              : 'khác với đáp án'}
        </span>
        {/* Ca vô hình: nói thẳng ra, vì tô sáng hai dòng trông hệt nhau chỉ làm rối thêm. */}
        {d.whitespaceOnly ? <Note>chỉ khác ở khoảng trắng</Note> : null}
        {d.trailingNewlineOnly ? <Note>chỉ khác ở ký tự xuống dòng cuối</Note> : null}
      </div>

      {input !== null ? (
        <div className="border-b border-line px-2.5 py-1.5">
          <p className="font-mono text-[11px] text-ink-6">input</p>
          <pre className="mt-0.5 overflow-x-auto font-mono text-[12px] whitespace-pre text-ink-3">{input}</pre>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <div className="min-w-[22rem]">
          <div
            className="grid gap-x-2 border-b border-line px-2.5 py-1 font-mono text-[11px] text-ink-6"
            style={{ gridTemplateColumns: GRID }}
          >
            <span />
            <span>{gotLabel}</span>
            <span>{wantLabel}</span>
          </div>

          {d.lines.map((l) => (
            <Line key={l.n} line={l} />
          ))}
        </div>
      </div>

      {d.hiddenLines > 0 ? (
        <p className="num border-t border-line px-2.5 py-1 font-mono text-[11px] text-ink-6">
          … còn {d.hiddenLines} dòng nữa không hiện
        </p>
      ) : null}
    </div>
  )
}

function Note({ children }: { children: string }) {
  return <span className="bg-[var(--tint-earth)] px-1.5 py-0.5 font-mono text-[11px] text-earth">{children}</span>
}

function Line({ line }: { line: DiffLine }) {
  const same = line.gotSpan === null && line.wantSpan === null && line.got === line.want
  return (
    <div
      className={`grid gap-x-2 px-2.5 py-px font-mono text-[12px] ${same ? 'text-ink-5' : 'text-ink-2'}`}
      style={{ gridTemplateColumns: GRID }}
    >
      <span className="num text-right text-[11px] text-ink-6">{line.n}</span>
      <Cell text={line.got} span={line.gotSpan} tint="var(--diff-got)" />
      <Cell text={line.want} span={line.wantSpan} tint="var(--diff-want)" />
    </div>
  )
}

function Cell({ text, span, tint }: { text: string | null; span: [number, number] | null; tint: string }) {
  if (text === null) {
    return <span className="text-[11px] text-ink-6">(thiếu dòng)</span>
  }

  if (span === null) {
    // Khoảng trống cứng để dòng rỗng vẫn chiếm chiều cao, giữ hai cột thẳng hàng.
    return <span className="break-all whitespace-pre-wrap">{text === '' ? ' ' : text}</span>
  }

  const [a, b] = span

  // Khoảng rỗng: phía này KHÔNG có ký tự nào ở chỗ phía kia có (thiếu ký tự, hoặc dư
  // bên đối diện). Không có gì để tô, nên dựng một vạch chỉ đúng vị trí.
  if (a === b) {
    return (
      <span className="break-all whitespace-pre-wrap">
        {text.slice(0, a)}
        <span className="inline-block h-[1.1em] w-0 translate-y-[0.2em] border-l-2 border-[var(--color-wa)]" />
        <span className="sr-only"> (thiếu ký tự ở đây) </span>
        {text.slice(b)}
      </span>
    )
  }

  return (
    <span className="break-all whitespace-pre-wrap">
      {text.slice(0, a)}
      <mark className="text-ink-1" style={{ background: tint }}>
        {showWhitespace(text.slice(a, b))}
      </mark>
      {text.slice(b)}
    </span>
  )
}
