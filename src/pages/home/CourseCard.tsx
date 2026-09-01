/**
 * Thẻ khoá học ở trang chủ (màn 02), kèm tiến độ.
 *
 * Tiến độ tính từ chính giáo trình: API khoá học không trả sẵn số bài AC, nên đếm
 * ở đây từ `status` của từng mục. Đếm ở client chấp nhận được vì mỗi người chỉ mở
 * vài khoá; đừng nhân rộng cách này cho bảng xếp hạng.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import type { CourseSummary } from '@/types/api'

interface SyllabusItem {
  kind: 'lesson' | 'problem'
  status: string | null
}
interface SyllabusSection {
  title: string
  items: SyllabusItem[]
}

export function CourseCard({ course }: { course: CourseSummary }) {
  const { data } = useQuery({
    queryKey: ['member', 'syllabus', course.id],
    queryFn: () => api.get<SyllabusSection[]>(`/api/member/courses/${course.id}/syllabus`),
  })

  const problems = (data ?? []).flatMap((s) => s.items).filter((i) => i.kind === 'problem')
  const ac = problems.filter((i) => i.status === 'da-ac').length
  const total = problems.length
  const percent = total > 0 ? Math.round((ac / total) * 100) : 0
  const sections = (data ?? []).length

  return (
    <Link
      to={`/khoa-hoc/${course.id}`}
      className="flex items-center gap-5 border border-line bg-surface-2 px-4 py-3.5 transition-colors duration-[120ms] ease-linear hover:bg-surface-sel"
    >
      <span className="min-w-0 flex-1">
        <span className="num block font-mono text-[11px] tracking-[0.06em] text-ink-6">{course.code}</span>
        <span className="mt-0.5 block truncate font-display text-[18px] text-ink-1">{course.name}</span>
        {data ? (
          <span className="num mt-1 block font-mono text-[11px] text-ink-5">
            {sections} chương · {total} bài
          </span>
        ) : null}
      </span>

      {data && total > 0 ? (
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="num font-mono text-[11px] text-ink-4">
            {ac}/{total} AC
          </span>
          <span className="num font-mono text-[15px] text-moss">{percent}%</span>
          {/* Thanh tiến độ là một vạch, không phải thẻ bo góc — đúng ngôn ngữ của hệ. */}
          <span aria-hidden className="block h-[3px] w-24 bg-line">
            <span className="block h-full bg-moss" style={{ width: `${percent}%` }} />
          </span>
        </span>
      ) : null}
    </Link>
  )
}
