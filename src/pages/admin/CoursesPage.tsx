/** FR-B1/B2/B3 — trang khoá học: tạo/sửa khoá, gán mentor, ghi danh member. */
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button, EmptyState, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { AdminShell } from './AdminShell'
import { CourseEnrollments } from './CourseEnrollments'
import { CourseForm } from './CourseForm'
import { CourseMentors } from './CourseMentors'
import type { AdminCourse, CourseStatus } from './types'

const STATUS: Record<CourseStatus, { label: string; className: string }> = {
  draft: { label: 'Nháp', className: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
  open: { label: 'Đang mở', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  archived: { label: 'Lưu trữ', className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300' },
}

export function AdminCoursesPage() {
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminCourse | null>(null)
  const [creating, setCreating] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'courses'],
    queryFn: () => api.get<AdminCourse[]>('/api/admin/courses'),
  })

  return (
    <AdminShell
      title="Khoá học"
      description="Tạo khoá ở trạng thái Nháp, gán mentor để họ soạn nội dung, rồi ghi danh member (US-1)."
    >
      <div className="mb-4">
        <Button
          variant="primary"
          onClick={() => {
            setCreating(true)
            setEditing(null)
          }}
        >
          <Plus size={15} /> Tạo khoá học
        </Button>
      </div>

      {creating ? <CourseForm course={null} onDone={() => setCreating(false)} /> : null}
      {editing ? <CourseForm course={editing} onDone={() => setEditing(null)} /> : null}

      {isLoading ? <Spinner /> : null}
      {data && data.length === 0 ? (
        <EmptyState title="Chưa có khoá học nào" hint="Tạo khoá đầu tiên bằng nút phía trên." />
      ) : null}

      <ul className="space-y-2">
        {data?.map((course) => {
          const open = openId === course.id
          return (
            <li key={course.id} className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2 p-3">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : course.id)}
                  aria-expanded={open}
                  className="flex min-w-0 items-center gap-2 text-left focus-visible:outline-2
                    focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                >
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{course.name}</span>
                    <span className="block truncate font-mono text-xs text-slate-500">{course.code}</span>
                  </span>
                </button>

                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS[course.status].className}`}>
                  {STATUS[course.status].label}
                </span>
                {course.selfEnroll ? (
                  <span className="rounded bg-[var(--color-primary-soft)] px-1.5 py-0.5 text-xs text-[var(--color-primary)]">
                    Tự ghi danh
                  </span>
                ) : null}

                <span className="ml-auto flex items-center gap-3 text-xs whitespace-nowrap text-slate-500">
                  <span>{course.mentorCount} mentor</span>
                  <span>{course.memberCount} member</span>
                </span>

                <Button
                  onClick={() => {
                    setEditing(course)
                    setCreating(false)
                  }}
                >
                  <Pencil size={14} /> Sửa
                </Button>
              </div>

              {/* Mentor và ghi danh chỉ nạp khi mở: hai truy vấn mỗi khoá × N khoá
                  là gánh vô ích cho một danh sách người ta chỉ mở từng cái một. */}
              {open ? (
                <div className="border-t border-slate-200 p-3 dark:border-slate-700">
                  <CourseMentors courseId={course.id} />
                  <CourseEnrollments courseId={course.id} />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </AdminShell>
  )
}
