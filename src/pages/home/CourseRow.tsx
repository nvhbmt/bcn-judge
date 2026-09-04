/**
 * Một dòng khoá học ở trang chủ (màn 02).
 *
 * Lưới 4 cột cố định `82px | 1fr | 180px | 92px` theo bản vẽ — mã khoá, tên + mô tả
 * ngắn, thanh tiến độ 18 ô, phần trăm căn phải. Cột giữa `min-w-0` để tên dài bị cắt
 * chứ không đẩy vỡ hai cột số bên phải.
 *
 * Đây là DÒNG chứ không phải THẺ: nó nằm trong `RowGroup`, các dòng dính liền nhau
 * ngăn bằng khe 1px. Bản trước dựng mỗi khoá thành một thẻ có viền riêng cách nhau
 * 8px — nhìn thì cũng gọn, nhưng sai ngôn ngữ nền tảng của hệ thiết kế và làm trang
 * chủ không ăn nhập với mọi bảng khác trong app.
 *
 * Tiến độ tính từ chính giáo trình: API khoá học không trả sẵn số bài AC, nên đếm
 * ở đây từ `status` của từng mục. Đếm ở client chấp nhận được vì mỗi người chỉ mở
 * vài khoá; đừng nhân rộng cách này cho bảng xếp hạng.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Segments } from '@/components/ui/patterns'
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

export function CourseRow({ course }: { course: CourseSummary }) {
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
      className="grid grid-cols-[82px_1fr] items-center gap-4 bg-surface-2 px-4.5 py-4 transition-colors duration-120 ease-linear hover:bg-surface-sel sm:grid-cols-[82px_1fr_180px_92px]"
    >
      <span className="num font-mono text-[14px] text-moss">{course.code}</span>

      <span className="min-w-0">
        <span className="block truncate text-[17px] font-semibold text-ink-1">{course.name}</span>
        {data ? (
          <span className="num mt-0.75 block truncate font-mono text-[12px] text-ink-5">
            {sections} chương · {total} bài
            {course.mentorName ? ` · mentor ${course.mentorName}` : ''}
          </span>
        ) : null}
      </span>

      {data && total > 0 ? (
        <>
          <span className="hidden sm:block">
            <Segments percent={percent} />
            <span className="num mt-1.5 block font-mono text-[12px] text-ink-5">
              {ac}/{total} AC
            </span>
          </span>
          <span className="num hidden text-right font-mono text-[14px] text-ink-4 sm:block">{percent}%</span>
        </>
      ) : (
        <>
          <span className="num hidden font-mono text-[12px] text-ink-6 sm:block">chưa có bài</span>
          <span aria-hidden className="hidden sm:block" />
        </>
      )}
    </Link>
  )
}
