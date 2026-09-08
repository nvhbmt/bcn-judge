/** FR-A2/A3/A4: admin cấp tài khoản (đơn lẻ + CSV), đặt lại mật khẩu, khoá/mở. */
import { and, asc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { generatePassword, hashPassword } from '@/auth/hash'
import { revokeAllSessionsOf } from '@/auth/session'
import { db, tx } from '@/db/pool'
import { courseEnrollments, courses, users } from '@/db/schema'
import { created, errors, ok } from '@/lib/apiResponse'
import { parseBody } from '@/lib/http'
import { audit } from '@/lib/audit'
import { isConstraintViolation } from '@/lib/dbError'

export const adminUserRoutes = new Hono()

const ROLES = ['admin', 'mentor', 'member'] as const

adminUserRoutes.get('/', async (c) => {
  const q = c.req.query('q')?.trim()
  const role = c.req.query('role')
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      disabled: users.disabled,
      disabledReason: users.disabledReason,
      disabledAt: users.disabledAt,
      mustChangePassword: users.mustChangePassword,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        role && (ROLES as readonly string[]).includes(role) ? eq(users.role, role) : undefined,
        q ? or(ilike(users.email, `%${q}%`), ilike(users.displayName, `%${q}%`)) : undefined,
      ),
    )
    .orderBy(asc(users.displayName))
    .limit(500)
  return ok(c, rows)
})

const createUserSchema = z.object({
  email: z.string().email().max(200),
  displayName: z.string().min(1).max(200),
  role: z.enum(ROLES),
  username: z.string().min(3).max(60).optional(),
  password: z.string().min(8).max(200).optional(),
})

adminUserRoutes.post('/', async (c) => {
  const body = await parseBody(c, createUserSchema)
  if (!body.ok) return body.response
  const me = c.get('user')

  const password = body.data.password ?? generatePassword()
  const { hash, algo } = await hashPassword(password)
  try {
    const [row] = await db
      .insert(users)
      .values({
        email: body.data.email,
        username: body.data.username ?? null,
        displayName: body.data.displayName,
        role: body.data.role,
        passwordHash: hash,
        hashAlgo: algo,
        mustChangePassword: true,
      })
      .returning({ id: users.id, email: users.email, role: users.role })
    await audit(me.id, 'user.create', 'user', row!.id, null, { email: row!.email, role: row!.role })
    // Mật khẩu ban đầu chỉ trả về ĐÚNG MỘT LẦN cho admin đọc rồi chuyển cho member.
    return created(c, { ...row, initialPassword: password })
  } catch (err) {
    if (isConstraintViolation(err, 'users_email_key')) {
      return errors.conflict(c, 'email_taken', 'Email đã tồn tại.')
    }
    throw err
  }
})

const importSchema = z.object({
  /** Mỗi dòng: email,họ tên,vai trò[,mã khoá] */
  csv: z.string().min(1).max(2_000_000),
})

adminUserRoutes.post('/import', async (c) => {
  const body = await parseBody(c, importSchema)
  if (!body.ok) return body.response
  const me = c.get('user')

  const results: { line: number; email: string; status: string; password?: string; message?: string }[] = []
  const lines = body.data.csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  for (const [index, line] of lines.entries()) {
    if (index === 0 && /^email\s*,/i.test(line)) continue
    const [email, displayName, role, courseCode] = line.split(',').map((s) => s?.trim() ?? '')
    const lineNo = index + 1
    if (!email || !displayName || !(ROLES as readonly string[]).includes(role ?? '')) {
      results.push({ line: lineNo, email: email ?? '', status: 'invalid', message: 'Thiếu email/họ tên/vai trò hợp lệ.' })
      continue
    }
    const password = generatePassword()
    const { hash, algo } = await hashPassword(password)
    try {
      await tx(async (t) => {
        const [row] = await t
          .insert(users)
          .values({
            email,
            displayName,
            role: role as (typeof ROLES)[number],
            passwordHash: hash,
            hashAlgo: algo,
            mustChangePassword: true,
          })
          .returning({ id: users.id })
        if (courseCode) {
          const [course] = await t.select({ id: courses.id }).from(courses).where(eq(courses.code, courseCode)).limit(1)
          if (!course) throw new Error(`không có khoá mã ${courseCode}`)
          await t.insert(courseEnrollments).values({ courseId: course.id, userId: row!.id, enrolledBy: me.id })
        }
      })
      results.push({ line: lineNo, email, status: 'created', password })
    } catch (err) {
      const message = isConstraintViolation(err, 'users_email_key') ? 'Email đã tồn tại.' : String(err).slice(0, 200)
      results.push({ line: lineNo, email, status: 'failed', message })
    }
  }

  await audit(me.id, 'user.import', 'user', null, null, { total: results.length })
  return ok(c, {
    created: results.filter((r) => r.status === 'created').length,
    failed: results.filter((r) => r.status !== 'created').length,
    results,
  })
})

const patchUserSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  role: z.enum(ROLES).optional(),
  disabled: z.boolean().optional(),
})

adminUserRoutes.patch('/:id', async (c) => {
  const body = await parseBody(c, patchUserSchema)
  if (!body.ok) return body.response
  const me = c.get('user')
  const id = c.req.param('id')

  if (id === me.id && body.data.role && body.data.role !== 'admin') {
    return errors.conflict(c, 'cannot_demote_self', 'Không thể tự hạ quyền admin của chính mình.')
  }

  // Khoá tay ghi lý do 'admin' để bộ quét Discord (auth/discordSweep.ts) và cú đăng nhập
  // Discord sau này không tự mở nhầm; mở khoá thì xoá cả lý do lẫn mốc giờ.
  const patch =
    body.data.disabled === undefined
      ? body.data
      : body.data.disabled
        ? { ...body.data, disabledReason: 'admin', disabledAt: sql`now()` }
        : { ...body.data, disabledReason: null, disabledAt: null }
  const [row] = await db
    .update(users)
    .set(patch)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .returning({ id: users.id, role: users.role, disabled: users.disabled })
  if (!row) return errors.notFound(c, 'Không tìm thấy tài khoản.')

  // FR-A4: khoá tài khoản → cắt mọi phiên ngay, nhưng bài nộp/tiến độ giữ nguyên.
  if (body.data.disabled === true) await revokeAllSessionsOf(id)
  await audit(me.id, 'user.update', 'user', id, null, body.data)
  return ok(c, row)
})

adminUserRoutes.post('/:id/reset-password', async (c) => {
  const me = c.get('user')
  const id = c.req.param('id')
  const password = generatePassword()
  const { hash, algo } = await hashPassword(password)

  const [row] = await db
    .update(users)
    .set({ passwordHash: hash, hashAlgo: algo, mustChangePassword: true })
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .returning({ id: users.id, email: users.email })
  if (!row) return errors.notFound(c, 'Không tìm thấy tài khoản.')

  await revokeAllSessionsOf(id)
  await audit(me.id, 'user.reset_password', 'user', id, null, null)
  return ok(c, { ...row, initialPassword: password })
})
