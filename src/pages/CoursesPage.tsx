import { useQuery } from '@tanstack/react-query'
import { LogOut, PencilRuler, ShieldCheck, Trophy, Users } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import type { CourseSummary } from '@/types/api'

/** Trang này là trang chủ của CẢ BA vai trò, nên nó cũng là lối vào duy nhất tới
 *  mọi cụm khác. Thiếu một link ở đây là cả một cụm trang không ai tới được. */
function NavLinkButton({ to, icon: Icon, children }: {
  to: string
  icon: ComponentType<{ size?: number }>
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
    >
      <Icon size={16} /> {children}
    </Link>
  )
}

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
          <NavLinkButton to="/team" icon={Users}>Team</NavLinkButton>
          {me && me.role !== 'member' ? (
            <>
              <NavLinkButton to="/mentor/contest" icon={Trophy}>Contest</NavLinkButton>
              <NavLinkButton to="/mentor/bai-tap" icon={PencilRuler}>Soạn bài</NavLinkButton>
            </>
          ) : null}
          {/* Lối vào duy nhất tới cả cụm /quan-tri (tài khoản, khoá học, team, cài
              đặt, tình trạng chấm). Không có nó thì năm trang đó chỉ tới được bằng
              cách gõ tay URL — App.tsx đã khai route nhưng không ai link tới. */}
          {me?.role === 'admin' ? (
            <NavLinkButton to="/quan-tri" icon={ShieldCheck}>Quản trị</NavLinkButton>
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
