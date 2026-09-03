import { and, eq, ilike, isNull, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../../db/pool'
import { users } from '../../db/schema'
import { ok } from '../../lib/apiResponse'

export const mentorMemberRoutes = new Hono()

/**
 * GET /api/mentor/members?q= — tìm member để ghi danh (FR-B3).
 *
 * Router RIÊNG chứ không nhét vào `mentorCourseRoutes`: router đó mount ở
 * `/api/mentor/courses`, nên đặt trong đó thì URL thật thành `/courses/members` và
 * còn đua với handler `/:id` của chính nó.
 *
 * Vì sao mentor cần endpoint riêng thay vì dùng `/api/admin/users`: đường đó là
 * requireAdmin, nên mentor mở ô chọn ra là 403 dù họ ghi danh được cho khoá mình
 * phụ trách (ma trận §3).
 *
 * HẸP HƠN đường của admin đúng bằng những gì một ô chọn cần: chỉ `role = 'member'`,
 * chỉ id/email/tên. Không trả `disabled`, `mustChangePassword`, `lastLogin` — mentor
 * không có việc gì với chúng, và bề mặt càng hẹp thì càng ít thứ để rò.
 *
 * Bắt buộc có `q`: liệt kê sạch danh bạ CLB không phải là việc của ô chọn này.
 */
mentorMemberRoutes.get('/', async (c) => {
  const q = c.req.query('q')?.trim()
  if (!q) return ok(c, [])

  const rows = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        eq(users.role, 'member'),
        or(ilike(users.email, `%${q}%`), ilike(users.displayName, `%${q}%`)),
      ),
    )
    .orderBy(users.displayName)
    .limit(20)

  return ok(c, rows)
})
