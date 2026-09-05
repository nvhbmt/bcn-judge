/** FR-B5: member chỉ thấy khoá ĐANG MỞ mà mình đã ghi danh. */
import { and, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { isCourseStaff } from '@/auth/middleware'
import type { AuthUser } from '@/auth/session'
import { db, q } from '@/db/pool'
import { courseEnrollments, courses } from '@/db/schema'
import { errors, ok } from '@/lib/apiResponse'
import { audit } from '@/lib/audit'
import { parseBody } from '@/lib/http'
import { getSettings } from '@/lib/settings'

export const memberCourseRoutes = new Hono()

/**
 * GET /api/member/announcement — banner thông báo toàn hệ thống (FR-H5).
 *
 * Đặt cạnh `memberLanguageRoutes` vì cùng tính chất: dữ liệu toàn cục, ai đăng nhập
 * cũng đọc được, không phụ thuộc khoá hay vai. Trả `{ text: '' }` khi không có thông
 * báo — chuỗi rỗng chứ không phải 404, để FE chỉ cần kiểm tra một thứ.
 */
export const memberAnnouncementRoutes = new Hono()

memberAnnouncementRoutes.get('/', async (c) => {
  const s = await getSettings()
  return ok(c, { text: typeof s.announcement === 'string' ? s.announcement.trim() : '' })
})

/** Danh sách ngôn ngữ đang bật — FE dựng dropdown từ đây (FR-D2, US-8). */
export const memberLanguageRoutes = new Hono()

memberLanguageRoutes.get('/', async (c) => {
  const rows = await q<{ id: string; name: string; versionLabel: string | null; cmMode: string | null }>(sql`
    SELECT id, name, version_label AS "versionLabel", cm_mode AS "cmMode"
    FROM languages WHERE enabled = true ORDER BY position
  `)
  return ok(c, rows)
})

/**
 * true khi user MỞ ĐƯỢC bản xem của member: đang ghi danh active vào khoá đang mở,
 * HOẶC là staff của chính khoá đó.
 *
 * Vế staff có vì nút "Xem như member" ở màn sửa khoá. Mentor không ghi danh vào khoá
 * mình dạy (họ nằm ở `course_mentors`), nên trước đây bấm nút đó là 404 "Không tìm
 * thấy khoá học" — nút do chính app vẽ ra dẫn tới một màn báo lỗi.
 *
 * Staff KHÔNG bị ràng `status = 'open'`: xem trước một khoá còn nháp đúng là lúc cần
 * xem trước nhất.
 */
export async function canViewCourseAsMember(user: AuthUser, courseId: string): Promise<boolean> {
  return (await isEnrolledInOpenCourse(user.id, courseId)) || (await isCourseStaff(user, courseId))
}

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

/**
 * POST /api/member/courses/tham-gia — member tự ghi danh bằng MÃ KHOÁ (FR-B4).
 *
 * Cờ `courses.self_enroll` đã có từ đầu ở schema, ở API quản trị và cả ở form của
 * admin — nhưng KHÔNG endpoint nào đọc nó, nên bật cờ lên không làm được gì cả.
 * Đây là đường khiến nó có tác dụng.
 *
 * Đặt TRƯỚC `/:id`: `tham-gia` là một đoạn đường dẫn tĩnh, để sau thì bị nuốt thành
 * một courseId — đúng lớp lỗi mà file này đã ghi lại ở `/standings` và `/moi`.
 *
 * Ba điều kiện đều trả về CÙNG một thông điệp khi hỏng: mã sai, khoá không mở, hay
 * khoá không bật tự ghi danh. Tách ra thành ba câu khác nhau là biến ô nhập mã thành
 * máy dò — người lạ gõ thử sẽ biết được mã nào có thật.
 */
memberCourseRoutes.post('/tham-gia', async (c) => {
  const me = c.get('user')
  const body = await parseBody(c, z.object({ code: z.string().min(1).max(40) }))
  if (!body.ok) return body.response
  // `courses.code` là citext nên phép so sánh đã KHÔNG phân biệt hoa thường ở tầng
  // kiểu. Viết `upper(code::text) = …` thì đúng kết quả nhưng vứt bỏ chỉ mục duy nhất
  // `courses_code_key` — mỗi lượt gõ mã thành một lượt quét toàn bảng.
  const code = body.data.code.trim()

  const [course] = await q<{ id: string; name: string }>(sql`
    SELECT id, name FROM courses
    WHERE code = ${code} AND status = 'open' AND self_enroll = true
  `)
  if (!course) {
    return errors.notFound(c, 'Mã khoá không đúng, hoặc khoá này không cho tự ghi danh.')
  }

  // Ghi danh lại người đã bị gỡ thì HỒI dòng cũ thay vì chèn dòng mới: unique
  // (course_id, user_id) chặn dòng thứ hai, và lịch sử `enrolled_at` giữ nguyên.
  const [row] = await q<{ id: string }>(sql`
    INSERT INTO course_enrollments (course_id, user_id, status, enrolled_by)
    VALUES (${course.id}, ${me.id}, 'active', ${me.id})
    ON CONFLICT (course_id, user_id)
      DO UPDATE SET status = 'active', removed_at = NULL
    RETURNING id
  `)
  await audit(me.id, 'course.self_enroll', 'course', course.id, null, { code })
  return ok(c, { id: row!.id, courseId: course.id, name: course.name })
})

memberCourseRoutes.get('/:id', async (c) => {
  const me = c.get('user')
  const courseId = c.req.param('id')
  if (!(await canViewCourseAsMember(me, courseId))) {
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
