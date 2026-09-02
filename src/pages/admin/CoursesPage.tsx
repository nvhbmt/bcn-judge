/** FR-B1/B2/B3 — trang khoá học: tạo/sửa khoá, gán mentor, ghi danh member. */
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, Spinner, buttonClass } from '@/components/ui'
import { AdminShell } from './AdminShell'
import { useAdminCourses } from './useAdminLists'
import type { CourseStatus } from './types'

const STATUS: Record<CourseStatus, { label: string; className: string }> = {
  draft: { label: 'Nháp', className: 'bg-surface-sel text-ink-2' },
  open: { label: 'Đang mở', className: 'bg-surface-sel text-moss' },
  archived: { label: 'Lưu trữ', className: 'bg-[var(--tint-earth)] text-earth' },
}


export function AdminCoursesPage() {
  const { data, isLoading } = useAdminCourses()

  return (
    <AdminShell
      title="Khoá học"
      description="Tạo khoá ở trạng thái Nháp, gán mentor để họ soạn nội dung, rồi ghi danh member."
    >
      <div className="mb-4">
        <Link to="/quan-tri/khoa-hoc/moi" className={buttonClass('primary')}>
          <Plus size={15} /> Tạo khoá học
        </Link>
      </div>

      {isLoading ? <Spinner /> : null}
      {data && data.length === 0 ? (
        <EmptyState title="Chưa có khoá học nào" hint="Tạo khoá đầu tiên bằng nút phía trên." />
      ) : null}

      <ul className="space-y-2">
        {data?.map((course) => (
          <li key={course.id} className="flex flex-wrap items-center gap-2 border border-line bg-surface-2 p-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{course.name}</span>
              <span className="block truncate font-mono text-xs text-ink-5">{course.code}</span>
            </span>

            <span className={` px-1.5 py-0.5 text-xs font-medium ${STATUS[course.status].className}`}>
              {STATUS[course.status].label}
            </span>
            {course.selfEnroll ? (
              <span className="bg-[var(--color-primary-soft)] px-1.5 py-0.5 text-xs text-[var(--color-primary)]">
                Tự ghi danh
              </span>
            ) : null}

            <span className="flex items-center gap-3 text-xs whitespace-nowrap text-ink-5">
              <span>{course.mentorCount} mentor</span>
              <span>{course.memberCount} member</span>
            </span>

            {/* MỘT lối ra: mọi phần của khoá — thông tin, giáo trình, ghi danh,
                mentor — nằm chung một màn có tab. Trước đây tách hai nút và không nút
                nào làm được hết việc. */}
            <Link to={`/mentor/khoa-hoc/${course.id}/thong-tin`} className={buttonClass('ghost', 'sm')}>
              <Pencil size={14} /> Sửa
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  )
}
