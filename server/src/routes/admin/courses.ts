/** FR-B1/B2/B3: admin tạo khoá, gán mentor, ghi danh member. */
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db, q, qt, tx } from '@/db/pool'
import { courseEnrollments, courseMentors, courses, users } from '@/db/schema'
import { created, errors, ok } from '@/lib/apiResponse'
import { audit } from '@/lib/audit'
import { describeDbError, isConstraintViolation } from '@/lib/dbError'
import { parseBody } from '@/lib/http'

export const adminCourseRoutes = new Hono()

const STATUSES = ['draft', 'open', 'archived'] as const

adminCourseRoutes.get('/', async (c) => {
  const rows = await db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      descriptionMd: courses.descriptionMd,
      status: courses.status,
      selfEnroll: courses.selfEnroll,
      createdAt: courses.createdAt,
      // `courses.id` viết THẲNG, không phải `${courses.id}`: drizzle render nội suy cột
      // thành `"id"` KHÔNG kèm tên bảng, nên trong truy vấn con nó dính vào cột `id`
      // của bảng bên trong nếu bảng đó có. `course_enrollments` có `id`, thành
      // `ce.course_id = ce.id` — không bao giờ đúng, và đếm ra 0 mà không báo lỗi gì.
      // (`course_mentors` khoá chính ghép, không có `id`, nên nó đúng do MAY.)
      mentorCount: sql<number>`(select count(*)::int from course_mentors cm where cm.course_id = courses.id)`,
      memberCount: sql<number>`(select count(*)::int from course_enrollments ce where ce.course_id = courses.id and ce.status = 'active')`,
    })
    .from(courses)
    .orderBy(asc(courses.code))
  return ok(c, rows)
})

const courseSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[\w-]+$/, 'Mã chỉ gồm chữ, số, gạch.'),
  name: z.string().min(1).max(200),
  descriptionMd: z.string().max(100_000).optional(),
  status: z.enum(STATUSES).optional(),
  selfEnroll: z.boolean().optional(),
})

adminCourseRoutes.post('/', async (c) => {
  const body = await parseBody(c, courseSchema)
  if (!body.ok) return body.response
  const me = c.get('user')
  try {
    const [row] = await db
      .insert(courses)
      .values({ ...body.data, createdBy: me.id })
      .returning()
    await audit(me.id, 'course.create', 'course', row!.id, null, { code: row!.code })
    return created(c, row)
  } catch (err) {
    if (isConstraintViolation(err, 'courses_code_key')) {
      return errors.conflict(c, 'code_taken', 'Mã khoá đã tồn tại.')
    }
    throw err
  }
})

adminCourseRoutes.patch('/:id', async (c) => {
  const body = await parseBody(c, courseSchema.partial())
  if (!body.ok) return body.response
  const me = c.get('user')
  const patch: Record<string, unknown> = { ...body.data, updatedAt: sql`now()` }
  if (body.data.status === 'archived') patch.archivedAt = sql`now()`

  const [row] = await db.update(courses).set(patch).where(eq(courses.id, c.req.param('id'))).returning()
  if (!row) return errors.notFound(c, 'Không tìm thấy khoá học.')
  await audit(me.id, 'course.update', 'course', row.id, null, body.data)
  return ok(c, row)
})

/**
 * POST /api/admin/courses/:id/clone — nhân bản khoá để mở lại mỗi kỳ (FR-B6).
 *
 * Sao chép chương, mục và BÀI TẬP kèm testcase; KHÔNG sao chép ghi danh, bài nộp hay
 * mentor. Khoá mới luôn ở trạng thái `draft` và tắt tự ghi danh — bản sao chưa soạn
 * xong mà member đã vào được là chuyện không ai muốn.
 *
 * Vì sao sao chép SÂU bài tập chứ không trỏ lại bài cũ (FR-D8 cho phép dùng chung):
 * FR-B6 nói rõ "sao chép toàn bộ chương, mục, TESTCASE", và mục đích của nó là mở
 * lại khoá cho kỳ sau — kỳ sau thường sửa đề và thêm test, mà sửa trên bài dùng
 * chung là sửa luôn vào khoá kỳ trước đang còn lịch sử bài nộp. Cần dùng chung thật
 * thì thêm bài vào khoá mới bằng ngân hàng bài, đó là đường của FR-D8.
 *
 * Cả việc chạy trong MỘT transaction: nhân bản nửa chừng để lại một khoá có chương
 * mà không có bài, và không ai biết nó dở dang.
 */
adminCourseRoutes.post('/:id/clone', async (c) => {
  const nguon = c.req.param('id')
  const me = c.get('user')
  const body = await parseBody(c, z.object({ code: z.string().min(1).max(40), name: z.string().min(1).max(200) }))
  if (!body.ok) return body.response

  const [goc] = await q<{ id: string }>(sql`SELECT id FROM courses WHERE id = ${nguon}`)
  if (!goc) return errors.notFound(c, 'Không tìm thấy khoá học.')

  try {
    const id = await tx(async (t) => {
      const [khoa] = await qt<{ id: string }>(t, sql`
        INSERT INTO courses (code, name, description_md, status, self_enroll, created_by)
        SELECT ${body.data.code}, ${body.data.name}, description_md, 'draft', false, ${me.id}
        FROM courses WHERE id = ${nguon}
        RETURNING id
      `)
      const moi = khoa!.id

      // MỘT câu cho toàn bộ phần còn lại. Mấu chốt là sinh sẵn id mới ngay trong CTE
      // (`gen_random_uuid()`), nhờ vậy có bảng ánh xạ cũ → mới để `items` trỏ đúng
      // chương mới và bài mới. `INSERT … RETURNING` không trả kèm cột nguồn nên không
      // dựng được ánh xạ, còn ghép theo (tiêu đề, vị trí) thì hai chương trùng tên là
      // trỏ nhầm — im lặng và rất khó lần ra.
      await t.execute(sql`
        WITH sec AS (
          SELECT s.id AS cu, gen_random_uuid()::text AS moi, s.title, s.position
          FROM sections s WHERE s.course_id = ${nguon}
        ),
        bai AS (
          SELECT DISTINCT p.id AS cu, gen_random_uuid()::text AS moi
          FROM items i
          JOIN sections s ON s.id = i.section_id AND s.course_id = ${nguon}
          JOIN problems p ON p.id = i.problem_id
          WHERE p.deleted_at IS NULL
        ),
        them_sec AS (
          INSERT INTO sections (id, course_id, title, position)
          SELECT moi, ${moi}, title, position FROM sec
        ),
        them_bai AS (
          -- KHÔNG chép testcase_rev / validated_testcase_rev: bản sao có bộ testcase
          -- MỚI, nên nó phải ở trạng thái chưa kiểm cho tới khi mentor bấm kiểm lại.
          -- Chép cờ đã-kiểm sang là nói dối về một phép kiểm chưa từng chạy.
          INSERT INTO problems (id, title, statement_md, input_desc_md, output_desc_md,
                                constraints_md, examples, time_limit_ms, memory_limit_mb,
                                difficulty, tags, allowed_language_ids, compare_mode, float_eps,
                                starter_code, solution_language_id, solution_source,
                                solution_visibility, scope_course_id, created_by, kind, harness)
          SELECT b.moi, p.title, p.statement_md, p.input_desc_md, p.output_desc_md,
                 p.constraints_md, p.examples, p.time_limit_ms, p.memory_limit_mb,
                 p.difficulty, p.tags, p.allowed_language_ids, p.compare_mode, p.float_eps,
                 p.starter_code, p.solution_language_id, p.solution_source,
                 p.solution_visibility, ${moi}, ${me.id}, p.kind, p.harness
          FROM bai b JOIN problems p ON p.id = b.cu
        ),
        them_tc AS (
          INSERT INTO testcases (problem_id, position, kind, weight, input, expected,
                                 input_bytes, expected_bytes, input_sha256)
          SELECT b.moi, t.position, t.kind, t.weight, t.input, t.expected,
                 t.input_bytes, t.expected_bytes, t.input_sha256
          FROM bai b JOIN testcases t ON t.problem_id = b.cu
        )
        INSERT INTO items (section_id, kind, title, position, status, visible_from,
                           lesson_body_md, problem_id)
        SELECT sec.moi, i.kind, i.title, i.position, i.status, i.visible_from,
               i.lesson_body_md, bai.moi
        FROM items i
        JOIN sec ON sec.cu = i.section_id
        LEFT JOIN bai ON bai.cu = i.problem_id
      `)
      return moi
    })
    await audit(me.id, 'course.clone', 'course', id, null, { from: nguon })
    return created(c, { id })
  } catch (err) {
    if (describeDbError(err).includes('courses_code_key')) {
      return errors.conflict(c, 'code_taken', 'Mã khoá đã tồn tại.')
    }
    throw err
  }
})

// ── Mentor của khoá (FR-B2) ────────────────────────────────────────────────

adminCourseRoutes.get('/:id/mentors', async (c) => {
  const rows = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName })
    .from(courseMentors)
    .innerJoin(users, eq(users.id, courseMentors.userId))
    .where(eq(courseMentors.courseId, c.req.param('id')))
  return ok(c, rows)
})

adminCourseRoutes.post('/:id/mentors', async (c) => {
  const body = await parseBody(c, z.object({ userId: z.string().min(1) }))
  if (!body.ok) return body.response
  const me = c.get('user')
  const courseId = c.req.param('id')

  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, body.data.userId)).limit(1)
  if (!target) return errors.notFound(c, 'Không tìm thấy tài khoản.')
  if (target.role === 'member') {
    return errors.conflict(c, 'not_staff', 'Chỉ tài khoản mentor hoặc admin mới gán làm mentor khoá.')
  }

  await db
    .insert(courseMentors)
    .values({ courseId, userId: body.data.userId, assignedBy: me.id })
    .onConflictDoNothing()
  await audit(me.id, 'course.mentor.add', 'course', courseId, null, { userId: body.data.userId })
  return ok(c, { ok: true })
})

adminCourseRoutes.delete('/:id/mentors/:userId', async (c) => {
  const me = c.get('user')
  await db
    .delete(courseMentors)
    .where(and(eq(courseMentors.courseId, c.req.param('id')), eq(courseMentors.userId, c.req.param('userId'))))
  await audit(me.id, 'course.mentor.remove', 'course', c.req.param('id'), null, { userId: c.req.param('userId') })
  return ok(c, { ok: true })
})

// ── Ghi danh (FR-B3) — dùng chung cho admin và mentor của khoá ─────────────

export const enrollSchema = z.object({
  /**
   * Dán danh sách email. KHÔNG validate từng email bằng zod: US-1 là dán 40 dòng
   * từ Excel, và một dòng lỗi định dạng mà 400 cả lô thì admin không biết dòng nào
   * sai. Email không hợp lệ và email không tồn tại đều được TRẢ VỀ để admin sửa.
   */
  emails: z.array(z.string().min(1).max(320)).min(1).max(1000),
})

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function enrollByEmails(courseId: string, emails: string[], actorId: string) {
  const cleaned = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))]
  const invalid = cleaned.filter((e) => !EMAIL_SHAPE.test(e))
  const wanted = cleaned.filter((e) => EMAIL_SHAPE.test(e))
  const found = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(inArray(sql`lower(${users.email})`, wanted))

  const foundEmails = new Set(found.map((u) => u.email.toLowerCase()))
  const missing = wanted.filter((e) => !foundEmails.has(e))
  const enrollable = found.filter((u) => u.role === 'member')

  if (enrollable.length > 0) {
    await tx(async (t) => {
      for (const user of enrollable) {
        await t
          .insert(courseEnrollments)
          .values({ courseId, userId: user.id, enrolledBy: actorId })
          .onConflictDoUpdate({
            target: [courseEnrollments.courseId, courseEnrollments.userId],
            set: { status: 'active', removedAt: null, enrolledBy: actorId },
          })
      }
    })
  }

  await audit(actorId, 'course.enroll', 'course', courseId, null, { enrolled: enrollable.length, missing: missing.length })
  return {
    enrolled: enrollable.length,
    missing,
    invalid,
    notMember: found.filter((u) => u.role !== 'member').map((u) => u.email),
  }
}

adminCourseRoutes.post('/:id/enrollments', async (c) => {
  const body = await parseBody(c, enrollSchema)
  if (!body.ok) return body.response
  return ok(c, await enrollByEmails(c.req.param('id'), body.data.emails, c.get('user').id))
})

adminCourseRoutes.delete('/:id/enrollments/:userId', async (c) => {
  const me = c.get('user')
  // FR-B3: gỡ ghi danh KHÔNG xoá bài nộp — chỉ lật trạng thái.
  const [row] = await db
    .update(courseEnrollments)
    .set({ status: 'removed', removedAt: sql`now()` })
    .where(
      and(eq(courseEnrollments.courseId, c.req.param('id')), eq(courseEnrollments.userId, c.req.param('userId'))),
    )
    .returning({ id: courseEnrollments.id })
  if (!row) return errors.notFound(c, 'Không tìm thấy ghi danh.')
  await audit(me.id, 'course.unenroll', 'course', c.req.param('id'), null, { userId: c.req.param('userId') })
  return ok(c, { ok: true })
})

adminCourseRoutes.get('/:id/enrollments', async (c) => {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      status: courseEnrollments.status,
      enrolledAt: courseEnrollments.enrolledAt,
    })
    .from(courseEnrollments)
    .innerJoin(users, eq(users.id, courseEnrollments.userId))
    .where(eq(courseEnrollments.courseId, c.req.param('id')))
    .orderBy(asc(users.displayName))
  return ok(c, rows)
})
