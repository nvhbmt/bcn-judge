/**
 * Dòng tiêu đề 38px của khung nội dung (màn 04).
 *
 * Đây là "một lớp tab" mà bản v2 nhắm tới: nó KHÔNG phải bộ chuyển tab — việc chuyển
 * do thanh icon lo — mà chỉ nói đang xem gì, đang ở bài thứ mấy, và cho nhảy sang bài
 * kề. Trước đó màn hình có hai lớp (thanh icon + dải tab Đề bài/Bài nộp) nên người
 * dùng phải nhớ mình đang ở lớp nào.
 *
 * Nút "bài trước / bài sau" là thứ người học dùng nhiều nhất sau nút nộp: làm xong
 * một bài thì đi tiếp, không ai muốn quay về danh sách rồi bấm vào bài kế.
 */
import { Link } from 'react-router-dom'

export interface SiblingLink {
  href: string
  title: string
}

export function ContentHeader({
  label,
  position,
  prev,
  next,
  asHeading = true,
}: {
  label: string
  /** Ví dụ "bài 4/6 · Tuần 2". Không suy ra được thì bỏ trống. */
  position?: string
  prev?: SiblingLink | null
  next?: SiblingLink | null
  /**
   * Nhãn này có phải `<h1>` của màn hay không.
   *
   * Panel "Đề bài" TỰ có `<h1>` là tên bài, nên ở đó nhãn phải là chữ thường: hai thẻ
   * `<h1>` trên một màn làm hỏng cây tiêu đề y như khi không có cái nào. Các panel còn
   * lại (Giáo trình, BXH, Trợ giúp, Bài nộp) không có `<h1>` nên nhãn này đảm nhiệm.
   */
  asHeading?: boolean
}) {
  const Label = asHeading ? 'h1' : 'span'
  return (
    <div className="flex h-[38px] shrink-0 items-center gap-3 border-b border-line bg-surface-1 px-5">
      <Label className="font-mono text-[11px] font-semibold tracking-[0.14em] text-ink-1 uppercase">{label}</Label>
      {position ? <span className="num font-mono text-[11px] text-ink-5">{position}</span> : null}

      {prev || next ? (
        <nav aria-label="Bài kề" className="num ml-auto flex items-center gap-2 font-mono text-[11px]">
          {prev ? (
            <Link to={prev.href} title={prev.title} className="text-ink-5 hover:text-ink-2">
              ← bài trước
            </Link>
          ) : (
            <span className="text-ink-7">← bài trước</span>
          )}
          <span aria-hidden className="text-ink-7">
            ·
          </span>
          {next ? (
            <Link to={next.href} title={next.title} className="text-ink-5 hover:text-ink-2">
              bài sau →
            </Link>
          ) : (
            <span className="text-ink-7">bài sau →</span>
          )}
        </nav>
      ) : null}
    </div>
  )
}
