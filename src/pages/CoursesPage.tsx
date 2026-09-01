import { useQuery } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, Spinner } from '@/components/ui'
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
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Khoá học của tôi</h1>
          <p className="text-sm text-slate-500">{me?.displayName}</p>
        </div>
        <Button onClick={() => void logout()}>
          <LogOut size={16} /> Đăng xuất
        </Button>
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
              className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-[var(--color-primary)] dark:border-slate-700 dark:bg-slate-900"
            >
              <span className="font-mono text-xs text-slate-500">{course.code}</span>
              <p className="font-medium">{course.name}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
