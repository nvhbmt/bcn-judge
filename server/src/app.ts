/**
 * Dựng Hono app mà KHÔNG serve (mẫu imath-test/server/src/app.ts) — test gọi
 * thẳng `app.request()` in-process, không cần cổng.
 *
 * Thứ tự mount có ý nghĩa: prefix cụ thể trước prefix chung (§5). Cây route chia
 * theo vai trò để ranh giới quyền auditable được bằng một test duyệt cây (§8).
 */
import { Hono } from 'hono'
import { requireAdmin, requireAuth, requireStaff } from './auth/middleware'
import { authRoutes } from './auth/routes'
import { pool } from './db/pool'
import { ok } from './lib/apiResponse'
import { adminCourseRoutes } from './routes/admin/courses'
import { adminUserRoutes } from './routes/admin/users'
import { memberCourseRoutes } from './routes/member/courses'
import { memberProblemRoutes, memberSubmissionRoutes } from './routes/member/submissions'
import { mentorCourseRoutes } from './routes/mentor/courses'
import { mentorProblemRoutes } from './routes/mentor/problems'

export function createApp(): Hono {
  const app = new Hono()

  app.get('/healthz', async (c) => {
    try {
      await pool.query('SELECT 1')
      return ok(c, { status: 'ok', db: 'up' })
    } catch {
      c.status(503)
      return c.json({ status: 'degraded', db: 'down' })
    }
  })

  app.route('/auth', authRoutes)

  const admin = new Hono()
  admin.use('*', requireAuth, requireAdmin)
  admin.route('/users', adminUserRoutes)
  admin.route('/courses', adminCourseRoutes)
  app.route('/api/admin', admin)

  const mentor = new Hono()
  mentor.use('*', requireAuth, requireStaff)
  mentor.route('/courses', mentorCourseRoutes)
  mentor.route('/problems', mentorProblemRoutes)
  app.route('/api/mentor', mentor)

  const member = new Hono()
  member.use('*', requireAuth)
  member.route('/courses', memberCourseRoutes)
  member.route('/problems', memberProblemRoutes)
  member.route('/submissions', memberSubmissionRoutes)
  app.route('/api/member', member)

  app.notFound((c) => {
    c.status(404)
    return c.json({ success: false, error: { code: 'not_found', message: 'Không có route này.' } })
  })

  app.onError((err, c) => {
    console.error('[api]', err)
    c.status(500)
    return c.json({ success: false, error: { code: 'internal', message: 'Lỗi hệ thống.' } })
  })

  return app
}
