import { useQuery } from '@tanstack/react-query'
import { LogOut, PencilRuler, Trophy, Users } from 'lucide-react'
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
        <div className="flex items-center gap-2">
          {/* Lối vào duy nhất tới màn soạn bài (FR-D). Trang chủ của mentor cũng là
              trang này, nên link phải đứng đây; member không thấy vì route cũng không có. */}
          <Link
            to="/team"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <Users size={16} /> Team
          </Link>
          {me && me.role !== 'member' ? (
            <Link
              to="/mentor/contest"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              <Trophy size={16} /> Contest
            </Link>
          ) : null}
          {me && me.role !== 'member' ? (
            <Link
              to="/mentor/bai-tap"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              <PencilRuler size={16} /> Soạn bài
            </Link>
          ) : null}
          <Button onClick={() => void logout()}>
            <LogOut size={16} /> Đăng xuất
          </Button>
        </div>
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
