import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { EmptyState, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import type { CourseSummary } from '@/types/api'

/** FR-B5: trang chủ member liệt kê khoá đã ghi danh. */
export function CoursesPage() {
  const { me, logout } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['member', 'courses'],
    queryFn: () => api.get<CourseSummary[]>('/api/member/courses'),
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Điều hướng và đăng xuất đã chuyển lên TopBar — đặt ở một chỗ duy nhất để
          không lặp lại lỗi "cụm không ai link tới". Trang này chỉ còn nội dung. */}
      <header className="mb-6">
        <h1 className="font-display text-[26px] text-ink-1">Khoá học của bạn</h1>
        <p className="text-[13px] text-ink-5">{me?.displayName}</p>
      </header>

      {isLoading ? <Spinner /> : null}

      {data && data.length === 0 ? (
        <EmptyState title="Chưa có khoá học nào" hint="Liên hệ quản lý viên để được ghi danh." />
      ) : null}

      <ul className="grid gap-3">
        {data?.map((course) => (
          <li key={course.id}>
            <Link
              to={`/khoa-hoc/${course.id}`}
              className="block border border-line bg-surface-2 p-4 transition hover:border-[var(--color-primary)]"
            >
              <span className="font-mono text-xs text-ink-5">{course.code}</span>
              <p className="font-medium">{course.name}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
