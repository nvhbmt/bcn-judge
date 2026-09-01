/**
 * Giáo trình dạng TRANG của màn 03 — khác bản trong thanh icon của workspace.
 *
 * Hai bản tồn tại song song có lý do: bản rail rộng 320px nên chỉ đủ chỗ cho icon
 * trạng thái + tên bài, còn bản này chạy hết chiều ngang nên bày được đủ thứ bản vẽ
 * yêu cầu — cột verdict, điểm, số lần nộp, và nút LÀM TIẾP trên bài đang dở.
 *
 * Mỗi chương là một `SectionRule` kèm số bài đã xong ở đầu bên phải, rồi tới một
 * `RowGroup`. Bài đang dở (đã thử mà chưa AC) là dòng DUY NHẤT được làm nổi trong
 * cả trang: nền đậm hơn một bậc, vạch trong màu earth, và nút mở thẳng editor.
 */
import { Link } from 'react-router-dom'
import { SectionRule } from '@/components/ui'
import { Row, RowGroup } from '@/components/ui/patterns'
import type { SyllabusItem, SyllabusSection } from '../workspace/SyllabusPanel'

/** Nhãn cột trái rộng 36px: verdict gần nhất, hoặc loại mục. */
function mark(item: SyllabusItem): { text: string; className: string } {
  if (item.kind === 'lesson') return { text: 'đọc', className: 'text-ink-6' }
  if (item.status === 'da-ac') return { text: 'AC', className: 'font-semibold text-moss' }
  if (item.status === 'da-thu') return { text: '···', className: 'font-semibold text-earth' }
  return { text: '—', className: 'text-ink-5' }
}

function meta(item: SyllabusItem): string {
  if (item.kind === 'lesson') return '—'
  if (item.attempts === 0) return 'chưa nộp'
  const diem = item.points !== null ? `${item.points} đ · ` : ''
  return `${diem}${item.attempts} lần`
}

function ItemRow({ item, courseId }: { item: SyllabusItem; courseId: string }) {
  const dangDo = item.kind === 'problem' && item.status === 'da-thu'
  const m = mark(item)

  return (
    <Row accent={dangDo ? 'earth' : null} interactive={!dangDo} className="gap-3.5 px-4 py-3">
      <span className={`num w-9 shrink-0 font-mono text-[11px] ${m.className}`}>{m.text}</span>

      <Link
        to={`/khoa-hoc/${courseId}/bai/${item.id}`}
        className={`min-w-0 flex-1 truncate text-[14px] hover:underline ${
          dangDo ? 'font-semibold text-ink-1' : 'text-ink-3'
        }`}
      >
        {item.title}
      </Link>

      <span className="num shrink-0 font-mono text-[11px] text-ink-5">{meta(item)}</span>

      {dangDo ? (
        <Link
          to={`/khoa-hoc/${courseId}/bai/${item.id}`}
          className="shrink-0 bg-[var(--moss-solid,var(--moss))] px-3 py-1.5 font-mono text-[11px] font-semibold text-on-accent uppercase transition-opacity duration-[120ms] ease-linear hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
        >
          Làm tiếp
        </Link>
      ) : null}
    </Row>
  )
}

export function SyllabusList({ courseId, sections }: { courseId: string; sections: SyllabusSection[] }) {
  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => {
        const problems = section.items.filter((i) => i.kind === 'problem')
        const done = problems.filter((i) => i.status === 'da-ac').length
        // Xong hết thì moss, còn dở thì earth — đúng nghĩa cố định của hai màu điểm
        // (moss = xong, earth = cần chú ý). Chương chỉ có bài đọc thì không có gì để đếm.
        const xong =
          problems.length > 0 ? (
            <span className={done === problems.length ? 'text-moss' : 'text-earth'}>
              {done}/{problems.length} xong
            </span>
          ) : undefined

        return (
          <section key={section.id}>
            <SectionRule label={section.title} meta={xong} level={3} />
            {/* Chương chưa có mục nào thì KHÔNG dựng RowGroup: nhóm rỗng vẫn có viền
                nên nó vẽ ra một khung dẹt trông như lỗi render. Nói thẳng ra chữ. */}
            {section.items.length === 0 ? (
              <p className="mt-2.5 text-[13px] text-ink-5">Chương này chưa có nội dung.</p>
            ) : (
              <RowGroup className="mt-2.5">
                {section.items.map((item) => (
                  <ItemRow key={item.id} item={item} courseId={courseId} />
                ))}
              </RowGroup>
            )}
          </section>
        )
      })}
    </div>
  )
}
