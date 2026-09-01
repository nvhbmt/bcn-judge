/**
 * Guard vai trò (copy imath-test/server/src/auth/middleware.ts, đổi tên vai trò).
 *
 * NFR-3: mọi kiểm tra quyền nằm ở server theo ma trận requirements §3; giao diện
 * chỉ ẩn/hiện. Ba vai trò — leader KHÔNG phải vai trò thứ tư mà là guard đọc thêm
 * `teamRole()` (ADR-14).
 */
import { createMiddleware } from 'hono/factory'
import { and, eq } from 'drizzle-orm'
import { errors } from '../lib/apiResponse'
import { readSessionCookie } from '../lib/http'
import { db } from '../db/pool'
import { courseMentors, teamMembers, teams } from '../db/schema'
import { resolveSession, type AuthUser } from './session'

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
  }
}

export const requireAuth = createMiddleware(async (c, next) => {
  const user = await resolveSession(readSessionCookie(c))
  if (!user) return errors.unauthorized(c)
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
