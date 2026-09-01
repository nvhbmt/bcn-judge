import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Spinner } from '@/components/ui'
import { CoursesPage } from '@/pages/CoursesPage'
import { LoginPage } from '@/pages/LoginPage'
import { ChangePasswordPage } from '@/pages/ChangePasswordPage'
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
      <Route path="/khoa-hoc/:courseId/bai/:itemId" element={<WorkspacePage />} />
      <Route path="/contest/:contestId/bai/:contestProblemId" element={<WorkspacePage />} />
      <Route path="/dang-nhap" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
