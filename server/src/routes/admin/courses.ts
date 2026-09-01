/** FR-B1/B2/B3: admin tạo khoá, gán mentor, ghi danh member. */
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db, tx } from '../../db/pool'
import { courseEnrollments, courseMentors, courses, users } from '../../db/schema'
import { created, errors, ok } from '../../lib/apiResponse'
import { audit } from '../../lib/audit'
import { isConstraintViolation } from '../../lib/dbError'
import { parseBody } from '../../lib/http'

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
      mentorCount: sql<number>`(select count(*)::int from course_mentors cm where cm.course_id = ${courses.id})`,
      memberCount: sql<number>`(select count(*)::int from course_enrollments ce where ce.course_id = ${courses.id} and ce.status = 'active')`,
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
