/** Khoá học dưới góc nhìn mentor — quyền theo TỪNG khoá được gán (ma trận §3). */
import { and, asc, eq, sql } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { isCourseStaff } from '../../auth/middleware'
import { db } from '../../db/pool'
import { courseEnrollments, courseMentors, courses, users } from '../../db/schema'
import { errors, ok } from '../../lib/apiResponse'
import { audit } from '../../lib/audit'
import { parseBody } from '../../lib/http'
import { enrollByEmails, enrollSchema } from '../admin/courses'

export const mentorCourseRoutes = new Hono()

/** Guard dùng lại cho mọi route :id — mentor ngoài khoá nhận 404, không phải 403,
 *  để không lộ sự tồn tại của khoá (mẫu IDOR §8). */
async function guardCourse(c: Context): Promise<string | null> {
  const courseId = c.req.param('id')
  if (!courseId) return null
  if (!(await isCourseStaff(c.get('user'), courseId))) return null
  return courseId
}

mentorCourseRoutes.get('/', async (c) => {
  const me = c.get('user')
  const rows = await db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      status: courses.status,
      memberCount: sql<number>`(select count(*)::int from course_enrollments ce where ce.course_id = ${courses.id} and ce.status = 'active')`,
    })
    .from(courses)
    .where(
      me.role === 'admin'
        ? undefined
        : sql`exists (select 1 from course_mentors cm where cm.course_id = ${courses.id} and cm.user_id = ${me.id})`,
    )
    .orderBy(asc(courses.code))
  return ok(c, rows)
})

mentorCourseRoutes.get('/:id', async (c) => {
  const courseId = await guardCourse(c)
  if (!courseId) return errors.notFound(c, 'Không tìm thấy khoá học.')
  const [row] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1)
  if (!row) return errors.notFound(c, 'Không tìm thấy khoá học.')
  return ok(c, row)
})

/** Ma trận §3: mentor được "sửa mô tả" khoá mình phụ trách (FR-B2). */
mentorCourseRoutes.patch('/:id', async (c) => {
  const courseId = await guardCourse(c)
  if (!courseId) return errors.notFound(c, 'Không tìm thấy khoá học.')
  const body = await parseBody(c, z.object({ descriptionMd: z.string().max(100_000) }))
  if (!body.ok) return body.response

  const [row] = await db
    .update(courses)
    .set({ descriptionMd: body.data.descriptionMd, updatedAt: sql`now()` })
    .where(eq(courses.id, courseId))
    .returning({ id: courses.id })
  await audit(c.get('user').id, 'course.update_description', 'course', courseId, null, null)
  return ok(c, row)
})

mentorCourseRoutes.get('/:id/enrollments', async (c) => {
  const courseId = await guardCourse(c)
  if (!courseId) return errors.notFound(c, 'Không tìm thấy khoá học.')
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      status: courseEnrollments.status,
    })
    .from(courseEnrollments)
    .innerJoin(users, eq(users.id, courseEnrollments.userId))
    .where(eq(courseEnrollments.courseId, courseId))
    .orderBy(asc(users.displayName))
  return ok(c, rows)
})

mentorCourseRoutes.post('/:id/enrollments', async (c) => {
  const courseId = await guardCourse(c)
  if (!courseId) return errors.notFound(c, 'Không tìm thấy khoá học.')
  const body = await parseBody(c, enrollSchema)
  if (!body.ok) return body.response
  return ok(c, await enrollByEmails(courseId, body.data.emails, c.get('user').id))
})

mentorCourseRoutes.delete('/:id/enrollments/:userId', async (c) => {
  const courseId = await guardCourse(c)
  if (!courseId) return errors.notFound(c, 'Không tìm thấy khoá học.')
  const [row] = await db
    .update(courseEnrollments)
    .set({ status: 'removed', removedAt: sql`now()` })
    .where(and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.userId, c.req.param('userId'))))
    .returning({ id: courseEnrollments.id })
  if (!row) return errors.notFound(c, 'Không tìm thấy ghi danh.')
  await audit(c.get('user').id, 'course.unenroll', 'course', courseId, null, { userId: c.req.param('userId') })
  return ok(c, { ok: true })
})

/** Danh sách mentor của khoá — chỉ đọc; gán/gỡ là quyền admin (ma trận §3). */
mentorCourseRoutes.get('/:id/mentors', async (c) => {
  const courseId = await guardCourse(c)
  if (!courseId) return errors.notFound(c, 'Không tìm thấy khoá học.')
  const rows = await db
    .select({ id: users.id, displayName: users.displayName, email: users.email })
    .from(courseMentors)
    .innerJoin(users, eq(users.id, courseMentors.userId))
    .where(eq(courseMentors.courseId, courseId))
  return ok(c, rows)
})
