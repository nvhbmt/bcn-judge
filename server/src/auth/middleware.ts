/**
 * Guard vai trò (copy imath-test/server/src/auth/middleware.ts, đổi tên vai trò).
 *
 * NFR-3: mọi kiểm tra quyền nằm ở server theo ma trận requirements §3; giao diện
 * chỉ ẩn/hiện. Ba vai trò — leader KHÔNG phải vai trò thứ tư mà là guard đọc thêm
 * `teamRole()` (ADR-14).
 */
import { createMiddleware } from 'hono/factory'
import { and, eq } from 'drizzle-orm'
import { errors } from '@/lib/apiResponse'
import { readSessionCookie } from '@/lib/http'
import { db } from '@/db/pool'
import { courseMentors, teamMembers, teams } from '@/db/schema'
import { resolveSession, type AuthUser } from './session'

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
  }
}

/**
 * FR-A2 chỉ được mở đúng ba đường này khi mật khẩu tạm chưa đổi: xem mình là ai,
 * đổi mật khẩu, và đăng xuất.
 */
const PATHS_KHI_CHUA_DOI_MAT_KHAU = new Set(['/auth/me', '/auth/change-password', '/auth/logout'])

export const requireAuth = createMiddleware(async (c, next) => {
  const user = await resolveSession(readSessionCookie(c))
  if (!user) return errors.unauthorized(c)

  // FR-A2 là cổng chặn CỨNG, và trước đây nó chỉ tồn tại ở router React
  // (src/App.tsx). Server cho qua vô điều kiện, nên mật khẩu một lần do admin cấp —
  // thường gửi qua chat CLB — dùng được vô thời hạn với toàn bộ API bằng bất kỳ
  // HTTP client nào. Đúng thứ NFR-3 nói không được xảy ra: "guard thật ở server,
  // UI chỉ là lớp che". Đặt ở ĐÂY chứ không phải ở từng nhóm route trong app.ts:
  // mọi nhóm /api/* đều đi qua requireAuth, nên nhóm mới thêm sau này được bảo vệ
  // sẵn thay vì phải nhớ gắn thêm — repo này đã dính đúng lớp lỗi "guard đặt một
  // chỗ rồi quên chỗ khác" nhiều lần.
  if (user.mustChangePassword && !PATHS_KHI_CHUA_DOI_MAT_KHAU.has(c.req.path)) {
    return errors.forbidden(c, 'Cần đổi mật khẩu lần đầu trước khi dùng hệ thống.')
  }

  c.set('user', user)
  await next()
})

export const requireAdmin = createMiddleware(async (c, next) => {
  const user = c.get('user')
  if (!user) return errors.unauthorized(c)
  if (user.role !== 'admin') return errors.forbidden(c, 'Chỉ admin được thực hiện.')
  await next()
})

/** admin hoặc mentor — quyền theo từng khoá kiểm riêng bằng assertCourseStaff(). */
export const requireStaff = createMiddleware(async (c, next) => {
  const user = c.get('user')
  if (!user) return errors.unauthorized(c)
  if (user.role !== 'admin' && user.role !== 'mentor') {
    return errors.forbidden(c, 'Chỉ admin hoặc mentor được thực hiện.')
  }
  await next()
})

/** Mentor chỉ có quyền trong khoá được gán; admin ngầm có quyền ở mọi khoá. */
export async function isCourseStaff(user: AuthUser, courseId: string): Promise<boolean> {
  if (user.role === 'admin') return true
  if (user.role !== 'mentor') return false
  const rows = await db
    .select({ courseId: courseMentors.courseId })
    .from(courseMentors)
    .where(and(eq(courseMentors.courseId, courseId), eq(courseMentors.userId, user.id)))
    .limit(1)
  return rows.length > 0
}

export interface TeamRole {
  teamId: string
  isLeader: boolean
}

/** FR-J: quan hệ của user với một team — dùng cho các route chỉ-đọc dưới /api/member. */
export async function teamRole(userId: string, teamId: string): Promise<TeamRole | null> {
  const rows = await db
    .select({ teamId: teamMembers.teamId, leaderId: teams.leaderId })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return { teamId: row.teamId, isLeader: row.leaderId === userId }
}
