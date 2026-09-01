import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Spinner } from '@/components/ui'
import { AdminPage } from '@/pages/AdminPage'
import { ContestPage } from '@/pages/ContestPage'
import { CourseDetailPage } from '@/pages/CourseDetailPage'
import { CoursesPage } from '@/pages/CoursesPage'
import { LoginPage } from '@/pages/LoginPage'
import { ChangePasswordPage } from '@/pages/ChangePasswordPage'
import { TeamPage } from '@/pages/TeamPage'
import { WorkspacePage } from '@/pages/workspace/WorkspacePage'
import { useAuth } from '@/stores/auth'

export function App() {
  const { me, loading, bootstrap } = useAuth()

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }

  if (!me) {
    return (
      <Routes>
        <Route path="/dang-nhap" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/dang-nhap" replace />} />
      </Routes>
    )
  }

  // FR-A2: mật khẩu do admin cấp phải đổi ở lần đăng nhập đầu — chặn mọi lối khác.
  if (me.mustChangePassword) {
    return (
      <Routes>
        <Route path="/doi-mat-khau" element={<ChangePasswordPage />} />
        <Route path="*" element={<Navigate to="/doi-mat-khau" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<CoursesPage />} />
      <Route path="/khoa-hoc/:courseId" element={<CourseDetailPage />} />
      <Route path="/khoa-hoc/:courseId/bai/:itemId" element={<WorkspacePage />} />
      <Route path="/contest/:contestId" element={<ContestPage />} />
      <Route path="/contest/:contestId/bai/:contestProblemId" element={<WorkspacePage />} />
      <Route path="/team" element={<TeamPage />} />
      {me.role === 'admin' ? <Route path="/quan-tri" element={<AdminPage />} /> : null}
      <Route path="/dang-nhap" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
