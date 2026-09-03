/** FR-A1/A3: đăng nhập, đăng xuất, me, đổi mật khẩu. */
import { eq, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db/pool'
import { users } from '../db/schema'
import { errors, ok } from '../lib/apiResponse'
import { audit } from '../lib/audit'
import { clearSessionCookie, clientIp, parseBody, rateLimit, readSessionCookie, setSessionCookie } from '../lib/http'
import { avatarUrl, discordEnabled } from './discordApi'
import { discordRoutes } from './discordRoutes'
import { hashPassword, verifyPassword } from './hash'
import { requireAuth } from './middleware'
import { createSession, revokeAllSessionsOf, revokeSession } from './session'

export const authRoutes = new Hono()

// Gắn Ở ĐÂY chứ không mount riêng trong app.ts: `/auth/discord` phải đứng trước
// `/auth` để khỏi bị nuốt, mà thứ tự mount là thứ dễ quên nhất khi thêm nhóm route.
// Lồng vào thì không có thứ tự nào để quên.
authRoutes.route('/discord', discordRoutes)

/**
 * Những cách đăng nhập đang BẬT. Màn đăng nhập hỏi trước khi vẽ nút.
 *
 * Không có endpoint này thì SPA phải đoán, và đoán sai theo hướng tệ nhất: vẽ nút
 * Discord ở một hệ chưa cấu hình, ai bấm cũng bị đá về đúng chỗ cũ mà không hiểu
 * vì sao. Công khai, vì đây đúng là thứ hiện ra trước khi đăng nhập.
 */
authRoutes.get('/providers', (c) => ok(c, { discord: discordEnabled() }))

const loginSchema = z.object({
  emailOrUsername: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
})

authRoutes.post('/login', async (c) => {
  const ip = clientIp(c)
  const limited = rateLimit(`login:${ip ?? 'unknown'}`, 10)
  if (!limited.ok) return errors.tooMany(c, `Thử lại sau ${limited.retryAfterSec} giây.`)

  const body = await parseBody(c, loginSchema)
  if (!body.ok) return body.response

  const key = body.data.emailOrUsername.trim()
  const rows = await db
    .select()
    .from(users)
    .where(or(eq(users.email, key), eq(users.username, key)))
    .limit(1)
  const user = rows[0]

  const passOk = await verifyPassword(body.data.password, user?.passwordHash ?? null)
  if (!user || !passOk || user.deletedAt) {
    return errors.badRequest(c, 'Email hoặc mật khẩu không đúng.')
  }
  if (user.disabled) return errors.forbidden(c, 'Tài khoản đã bị khoá.')

  const session = await createSession(user.id, ip, c.req.header('user-agent') ?? null)
  setSessionCookie(c, session.token, session.maxAgeSec)
  await db.update(users).set({ lastLogin: sql`now()` }).where(eq(users.id, user.id))

  return ok(c, {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    discordUsername: user.discordUsername,
    avatarUrl: avatarUrl(user.discordId, user.discordAvatar),
  })
})

authRoutes.post('/logout', async (c) => {
  await revokeSession(readSessionCookie(c))
  clearSessionCookie(c)
  return ok(c, { ok: true })
})

authRoutes.get('/me', requireAuth, (c) => ok(c, c.get('user')))

/**
 * Tự đổi tên hiển thị.
 *
 * Đây là thứ DUY NHẤT người dùng tự sửa được trong hồ sơ của mình. Email là khoá
 * định danh (và là thứ Discord khớp vào), vai trò do admin cấp — cả hai đổi được ở
 * đây thì cổng quyền của hệ thống nằm trong tay chính người bị quản.
 *
 * `min(1).max(200)` khớp đúng ràng buộc admin đang dùng cho cùng cột (routes/admin/
 * users.ts): hai đường ghi vào một cột mà nhận hai khoảng độ dài khác nhau thì có
 * tên hợp lệ ở đường này lại vỡ ở đường kia.
 */
const renameSchema = z.object({ displayName: z.string().min(1).max(200) })

authRoutes.patch('/me', requireAuth, async (c) => {
  const body = await parseBody(c, renameSchema)
  if (!body.ok) return body.response
  const me = c.get('user')

  // Cắt khoảng trắng hai đầu rồi mới kiểm lại: một chuỗi toàn dấu cách qua được
  // `min(1)` nhưng hiện ra là một ô trống, và người đó biến mất khỏi mọi bảng.
  const ten = body.data.displayName.trim()
  if (ten === '') return errors.badRequest(c, 'Tên hiển thị không được để trống.')

  await db.update(users).set({ displayName: ten }).where(eq(users.id, me.id))
  await audit(me.id, 'user.rename', 'user', me.id, { displayName: me.displayName }, { displayName: ten })

  return ok(c, { displayName: ten })
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8, 'Mật khẩu mới tối thiểu 8 ký tự.').max(200),
})

authRoutes.post('/change-password', requireAuth, async (c) => {
  const body = await parseBody(c, changePasswordSchema)
  if (!body.ok) return body.response
  const me = c.get('user')

  const rows = await db.select().from(users).where(eq(users.id, me.id)).limit(1)
  const user = rows[0]
  if (!user) return errors.unauthorized(c)
  if (!(await verifyPassword(body.data.currentPassword, user.passwordHash))) {
    return errors.badRequest(c, 'Mật khẩu hiện tại không đúng.')
  }

  const { hash, algo } = await hashPassword(body.data.newPassword)
  await db
    .update(users)
    .set({ passwordHash: hash, hashAlgo: algo, mustChangePassword: false })
    .where(eq(users.id, me.id))

  // Đổi mật khẩu thu hồi mọi phiên khác; phiên hiện tại cấp lại.
  await revokeAllSessionsOf(me.id)
  const session = await createSession(me.id, clientIp(c), c.req.header('user-agent') ?? null)
  setSessionCookie(c, session.token, session.maxAgeSec)

  return ok(c, { ok: true })
})
