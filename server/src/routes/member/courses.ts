/** FR-B5: member chỉ thấy khoá ĐANG MỞ mà mình đã ghi danh. */
import { and, asc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../../db/pool'
import { courseEnrollments, courses } from '../../db/schema'
import { errors, ok } from '../../lib/apiResponse'

export const memberCourseRoutes = new Hono()

/** true khi user đang ghi danh active vào khoá đang mở. */
export async function isEnrolledInOpenCourse(userId: string, courseId: string): Promise<boolean> {
  const rows = await db
    .select({ id: courses.id })
    .from(courseEnrollments)
    .innerJoin(courses, eq(courses.id, courseEnrollments.courseId))
    .where(
      and(
        eq(courseEnrollments.userId, userId),
        eq(courseEnrollments.courseId, courseId),
        eq(courseEnrollments.status, 'active'),
        eq(courses.status, 'open'),
      ),
    )
    .limit(1)
  return rows.length > 0
}

memberCourseRoutes.get('/', async (c) => {
  const me = c.get('user')
  const rows = await db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      descriptionMd: courses.descriptionMd,
      enrolledAt: courseEnrollments.enrolledAt,
    })
    .from(courseEnrollments)
    .innerJoin(courses, eq(courses.id, courseEnrollments.courseId))
    .where(
      and(
        eq(courseEnrollments.userId, me.id),
        eq(courseEnrollments.status, 'active'),
        eq(courses.status, 'open'),
      ),
    )
    .orderBy(asc(courses.name))
  return ok(c, rows)
})

memberCourseRoutes.get('/:id', async (c) => {
  const me = c.get('user')
  const courseId = c.req.param('id')
  if (!(await isEnrolledInOpenCourse(me.id, courseId))) {
    return errors.notFound(c, 'Không tìm thấy khoá học.')
  }
  const [row] = await db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      descriptionMd: courses.descriptionMd,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)
  return ok(c, row)
})
