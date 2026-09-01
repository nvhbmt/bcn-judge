import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Spinner } from '@/components/ui'
import { AdminCoursesPage } from '@/pages/admin/CoursesPage'
import { AdminJudgePage } from '@/pages/admin/JudgeStatusPage'
import { AdminSettingsPage } from '@/pages/admin/SettingsPage'
import { AdminTeamsPage } from '@/pages/admin/TeamsPage'
import { AdminUsersPage } from '@/pages/admin/UsersPage'
import { ContestPage } from '@/pages/ContestPage'
import { CourseDetailPage } from '@/pages/CourseDetailPage'
import { CoursesPage } from '@/pages/CoursesPage'
import { LoginPage } from '@/pages/LoginPage'
import { ChangePasswordPage } from '@/pages/ChangePasswordPage'
import { ContestEditorPage } from '@/pages/mentor/ContestEditorPage'
import { ContestListPage } from '@/pages/mentor/ContestListPage'
import { ContestStatsPage } from '@/pages/mentor/ContestStatsPage'
import { CourseContentPage } from '@/pages/mentor/CourseContentPage'
import { ProblemEditorPage } from '@/pages/mentor/ProblemEditorPage'
import { ProblemListPage } from '@/pages/mentor/ProblemListPage'
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
      {/* Cụm quản trị (FR-A/B/H/J). Đây chỉ là lớp che UI — quyền thật do
          requireAuth + requireAdmin ở server quyết định (app.ts:43). */}
      {me.role === 'admin' ? (
        <>
          <Route path="/quan-tri" element={<AdminJudgePage />} />
          <Route path="/quan-tri/tai-khoan" element={<AdminUsersPage />} />
          <Route path="/quan-tri/khoa-hoc" element={<AdminCoursesPage />} />
          <Route path="/quan-tri/team" element={<AdminTeamsPage />} />
          <Route path="/quan-tri/cai-dat" element={<AdminSettingsPage />} />
        </>
      ) : null}
      {/* FR-D: màn soạn bài của mentor. Admin ngầm có mọi quyền của mentor (§3) nên
          điều kiện là "không phải member" chứ không phải role === 'mentor'. Đây chỉ
          là lớp che UI; quyền thật do requireStaff + canEdit() ở server quyết định. */}
      {me.role !== 'member' ? <Route path="/mentor/bai-tap" element={<ProblemListPage />} /> : null}
      {me.role !== 'member' ? (
        <Route path="/mentor/bai-tap/:problemId" element={<ProblemEditorPage />} />
      ) : null}
      {/* FR-C1/C3 + FR-I: soạn giáo trình khoá và cụm contest. Cùng lý do "không
          phải member" như trên; server chặn thật bằng requireStaff + isCourseStaff. */}
      {me.role !== 'member' ? (
        <>
          <Route path="/mentor/khoa-hoc/:courseId" element={<CourseContentPage />} />
          <Route path="/mentor/contest" element={<ContestListPage />} />
          <Route path="/mentor/contest/:contestId" element={<ContestEditorPage />} />
          <Route path="/mentor/contest/:contestId/thong-ke" element={<ContestStatsPage />} />
        </>
      ) : null}
      <Route path="/dang-nhap" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
