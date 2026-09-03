/** FR-B5: member chỉ thấy khoá ĐANG MỞ mà mình đã ghi danh. */
import { and, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db, q } from '../../db/pool'
import { courseEnrollments, courses } from '../../db/schema'
import { errors, ok } from '../../lib/apiResponse'

export const memberCourseRoutes = new Hono()

/** Danh sách ngôn ngữ đang bật — FE dựng dropdown từ đây (FR-D2, US-8). */
export const memberLanguageRoutes = new Hono()

memberLanguageRoutes.get('/', async (c) => {
  const rows = await q<{ id: string; name: string; versionLabel: string | null; cmMode: string | null }>(sql`
    SELECT id, name, version_label AS "versionLabel", cm_mode AS "cmMode"
    FROM languages WHERE enabled = true ORDER BY position
  `)
  return ok(c, rows)
})

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
  // Kèm tên MỘT mentor cho mỗi khoá (người có tên xếp trước). Dòng khoá ở trang chủ
  // nói "4 chương · 18 bài · mentor Quốc Bảo" — biết hỏi ai là một nửa giá trị của
  // dòng đó. Lấy bằng LATERAL nên vẫn một câu truy vấn, không N+1.
  const rows = await q<{
    id: string
    code: string
    name: string
    descriptionMd: string | null
    mentorName: string | null
  }>(sql`
    SELECT c.id, c.code, c.name, c.description_md AS "descriptionMd", m.display_name AS "mentorName"
    FROM course_enrollments ce
    JOIN courses c ON c.id = ce.course_id
    LEFT JOIN LATERAL (
      SELECT u.display_name
      FROM course_mentors cm JOIN users u ON u.id = cm.user_id
      WHERE cm.course_id = c.id AND u.disabled = false AND u.deleted_at IS NULL
      ORDER BY u.display_name
      LIMIT 1
    ) m ON true
    WHERE ce.user_id = ${me.id} AND ce.status = 'active' AND c.status = 'open'
    ORDER BY c.name
  `)
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
  if (!row) return errors.notFound(c, 'Không tìm thấy khoá học.')

  // Mentor của khoá: member cần biết hỏi ai khi tắc. Chỉ tên và email công vụ —
  // KHÔNG trả id, vai trò hay bất cứ thứ gì khác của bảng users.
  const mentors = await q<{ displayName: string; email: string }>(sql`
    SELECT u.display_name AS "displayName", u.email
    FROM course_mentors cm JOIN users u ON u.id = cm.user_id
    WHERE cm.course_id = ${courseId} AND u.disabled = false AND u.deleted_at IS NULL
    ORDER BY u.display_name
  `)

  // Ngôn ngữ dùng được trong khoá = hợp của allowed_language_ids trên các bài ĐÃ
  // XUẤT BẢN của khoá, giao với ngôn ngữ đang bật. Bài để NULL nghĩa là "mọi ngôn
  // ngữ", nên gặp một bài như vậy là cả danh sách đang bật đều dùng được.
  const languages = await q<{ id: string; name: string }>(sql`
    SELECT l.id, l.name
    FROM languages l
    WHERE l.enabled = true AND EXISTS (
      SELECT 1
      FROM items i
      JOIN sections sec ON sec.id = i.section_id
      JOIN problems p ON p.id = i.problem_id
      WHERE sec.course_id = ${courseId}
        AND i.status = 'published'
        AND p.deleted_at IS NULL
        AND (p.allowed_language_ids IS NULL OR l.id = ANY (p.allowed_language_ids))
    )
    ORDER BY l.position
  `)

  return ok(c, { ...row, mentors, languages })
})
