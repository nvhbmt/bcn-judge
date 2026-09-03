import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import { Spinner } from '@/components/ui'
import { AdminCoursesPage } from '@/pages/admin/CoursesPage'
import { AdminCourseCreatePage } from '@/pages/admin/CourseCreatePage'
import { AdminLanguageEditPage } from '@/pages/admin/LanguageEditPage'
import { AdminTeamCreatePage, AdminTeamEditPage } from '@/pages/admin/TeamEditPage'
import { AdminJudgePage } from '@/pages/admin/JudgeStatusPage'
import { AdminSettingsPage } from '@/pages/admin/SettingsPage'
import { AdminTeamsPage } from '@/pages/admin/TeamsPage'
import { AdminUsersPage } from '@/pages/admin/UsersPage'
/* Đặt bí danh vì mentor cũng có một ContestListPage (màn soạn contest). */
import { ContestListPage as MemberContestListPage } from '@/pages/ContestListPage'
import { ContestPage } from '@/pages/ContestPage'
import { CourseDetailPage } from '@/pages/CourseDetailPage'
import { CoursesPage } from '@/pages/CoursesPage'
import { LoginPage } from '@/pages/LoginPage'
import { AccountPage } from '@/pages/AccountPage'
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
import type { Me } from '@/types/api'

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
    /* Thanh trên nằm NGOÀI cây route: điều hướng toàn cục phải có ở mọi màn đã đăng
       nhập, không phụ thuộc vào việc trang nào nhớ vẽ nó. Xem TopBar.tsx. */
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="min-h-0 flex-1 overflow-auto">
        <AppRoutes role={me.role} />
      </div>
    </div>
  )
}

/** Tách riêng để thanh trên bọc ngoài mà cây route không phải thụt lề lại. */
function AppRoutes({ role }: { role: Me['role'] }) {
  return (
    <Routes>
      <Route path="/" element={<CoursesPage />} />
      <Route path="/khoa-hoc/:courseId" element={<CourseDetailPage />} />
      <Route path="/khoa-hoc/:courseId/bai/:itemId" element={<WorkspacePage />} />
      <Route path="/contest" element={<MemberContestListPage />} />
      <Route path="/contest/:contestId" element={<ContestPage />} />
      <Route path="/contest/:contestId/bai/:contestProblemId" element={<WorkspacePage />} />
      <Route path="/team" element={<TeamPage />} />
      {/* Trang tài khoản: gắn/bỏ gắn Discord, và là chỗ hạ cánh của callback OAuth —
          xem AccountPage.tsx. */}
      <Route path="/tai-khoan" element={<AccountPage />} />
      {/* Đổi mật khẩu TỰ NGUYỆN. Trước đây route này chỉ có trong nhánh bắt đổi lần
          đầu, nên đổi xong một lần là không còn lối vào — dù `/auth/change-password`
          ở server vẫn nhận với mọi tài khoản đã đăng nhập. Lối vào ở UserMenu. */}
      <Route path="/doi-mat-khau" element={<ChangePasswordPage />} />
      {/* Cụm quản trị (FR-A/B/H/J). Đây chỉ là lớp che UI — quyền thật do
          requireAuth + requireAdmin ở server quyết định (app.ts:43). */}
      {role === 'admin' ? (
        <>
          <Route path="/quan-tri" element={<AdminJudgePage />} />
          <Route path="/quan-tri/tai-khoan" element={<AdminUsersPage />} />
          <Route path="/quan-tri/khoa-hoc" element={<AdminCoursesPage />} />
          {/* `/moi` phải đứng TRƯỚC `/:courseId`, nếu không "moi" bị nuốt thành id
              và trang tạo mở ra thành "không tìm thấy khoá học". */}
          <Route path="/quan-tri/khoa-hoc/moi" element={<AdminCourseCreatePage />} />
          <Route path="/quan-tri/team" element={<AdminTeamsPage />} />
          <Route path="/quan-tri/team/moi" element={<AdminTeamCreatePage />} />
          <Route path="/quan-tri/team/:teamId" element={<AdminTeamEditPage />} />
          <Route path="/quan-tri/cai-dat" element={<AdminSettingsPage />} />
          <Route path="/quan-tri/cai-dat/ngon-ngu/:languageId" element={<AdminLanguageEditPage />} />
        </>
      ) : null}
      {/* FR-D: màn soạn bài của mentor. Admin ngầm có mọi quyền của mentor (§3) nên
          điều kiện là "không phải member" chứ không phải role === 'mentor'. Đây chỉ
          là lớp che UI; quyền thật do requireStaff + canEdit() ở server quyết định. */}
      {role !== 'member' ? <Route path="/mentor/bai-tap" element={<ProblemListPage />} /> : null}
      {role !== 'member' ? (
        <Route path="/mentor/bai-tap/:problemId" element={<ProblemEditorPage />} />
      ) : null}
      {/* FR-C1/C3 + FR-I: soạn giáo trình khoá và cụm contest. Cùng lý do "không
          phải member" như trên; server chặn thật bằng requireStaff + isCourseStaff. */}
      {role !== 'member' ? (
        <>
          {/* Một màn sửa khoá cho cả hai vai; tab nằm trong URL nên tải lại vẫn
              đúng chỗ. Không tab thì trang tự đưa về tab đầu mà vai này thấy được. */}
          <Route path="/mentor/khoa-hoc/:courseId" element={<CourseContentPage />} />
          <Route path="/mentor/khoa-hoc/:courseId/:tab" element={<CourseContentPage />} />
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
