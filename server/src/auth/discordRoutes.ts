/**
 * Đăng nhập / gắn tài khoản bằng Discord.
 *
 * NGUYÊN TẮC LỚN NHẤT: callback KHÔNG BAO GIỜ tạo user mới. Discord ở đây là một
 * cách xác thực tài khoản ĐÃ CÓ, không phải cửa đăng ký. Màn đăng nhập nói thẳng
 * điều đó ("Liên hệ ngay các mentor để được cấp tài khoản"), và vai trò / ghi danh /
 * team đều do admin cấp — tự tạo user là mở toang cả ba thứ đó cho bất kỳ ai có
 * Discord. Không khớp được với tài khoản nào thì trả về màn đăng nhập kèm lý do.
 *
 * Hai đường gắn được Discord vào một tài khoản:
 *   1. GẮN CHỦ ĐỘNG (`intent=link`) — đang đăng nhập rồi thì bấm gắn. Đây là đường
 *      luôn chạy được, kể cả khi email tài khoản là thứ không gửi thư tới được
 *      (seed dùng `@bcn.local`, không ai đăng ký Discord bằng email đó).
 *   2. KHỚP EMAIL ở lần đăng nhập đầu — chỉ khi Discord xác nhận email ĐÃ XÁC MINH.
 *      Đây đúng mức tin cậy của "đặt lại mật khẩu qua email": ai kiểm soát hòm thư
 *      thì vào được. Email chưa xác minh KHÔNG được tính, vì lúc đó chuỗi email chỉ
 *      là chữ người ta tự gõ.
 *
 * `state` chống CSRF theo lối double-submit: một chuỗi ngẫu nhiên vừa nằm trong URL
 * gửi sang Discord vừa nằm trong cookie HttpOnly. Kẻ tấn công dựng được URL callback
 * nhưng không đặt được cookie trên trình duyệt nạn nhân. Cookie phải là SameSite=Lax
 * chứ không Strict: callback là điều hướng từ discord.com sang, tức cross-site — với
 * Strict thì cookie không được gửi kèm và MỌI lần đăng nhập đều hỏng.
 */
import { randomBytes } from 'node:crypto'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/pool'
import { users } from '../db/schema'
import { errors, ok } from '../lib/apiResponse'
import { audit } from '../lib/audit'
import { clientIp, rateLimit, readSessionCookie, setSessionCookie } from '../lib/http'
import { authorizeUrl, discordEnabled, exchangeCodeForUser } from './discordApi'
import { requireAuth } from './middleware'
import { createSession, resolveSession } from './session'

export const discordRoutes = new Hono()

const STATE_COOKIE = 'bcn_discord_state'
const STATE_TTL_SEC = 600

type Intent = 'login' | 'link'

/** Mã lý do đưa về SPA qua query `?discord=…`; chữ tiếng Việt do SPA dựng. */
type Reason = 'tat' | 'state' | 'tu_choi' | 'loi' | 'chua_gan' | 'gan_nguoi_khac' | 'bi_khoa' | 'da_gan'

function setStateCookie(c: Parameters<typeof setSessionCookie>[0], value: string, maxAgeSec: number): void {
  const parts = [
    `${STATE_COOKIE}=${value}`,
    'Path=/auth/discord',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ]
  if (process.env.SECURE_COOKIE === '1') parts.push('Secure')
  c.header('Set-Cookie', parts.join('; '), { append: true })
}

function readStateCookie(c: { req: { header: (n: string) => string | undefined } }): string | null {
  const header = c.req.header('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === STATE_COOKIE) return rest.join('=') || null
  }
  return null
}

/** Về SPA kèm lý do. Đường dẫn TƯƠNG ĐỐI: dev đi qua proxy vite, prod qua Caddy —
 *  cả hai đều cùng origin với SPA, nên không cần biết tên miền là gì. */
function back(c: Parameters<typeof setSessionCookie>[0], path: string, reason?: Reason): Response {
  return c.redirect(reason ? `${path}?discord=${reason}` : path)
}

discordRoutes.get('/', async (c) => {
  if (!discordEnabled()) return back(c, '/dang-nhap', 'tat')

  const limited = rateLimit(`discord:${clientIp(c) ?? 'unknown'}`, 20)
  if (!limited.ok) return errors.tooMany(c, `Thử lại sau ${limited.retryAfterSec} giây.`)

  const intent: Intent = c.req.query('intent') === 'link' ? 'link' : 'login'
  const state = randomBytes(16).toString('base64url')

  // Ý ĐỊNH nằm trong cookie chứ không ở query của callback: để ở query thì ai cũng
  // sửa được `link` thành `login` giữa chừng.
  setStateCookie(c, `${state}.${intent}`, STATE_TTL_SEC)
  return c.redirect(authorizeUrl(state))
})

discordRoutes.get('/callback', async (c) => {
  if (!discordEnabled()) return back(c, '/dang-nhap', 'tat')

  const saved = readStateCookie(c)
  setStateCookie(c, '', 0) // dùng một lần, hỏng hay không cũng vứt

  // Người dùng bấm "Cancel" ở màn Discord — không phải lỗi, đừng báo như lỗi.
  if (c.req.query('error')) return back(c, '/dang-nhap', 'tu_choi')

  const [savedState, savedIntent] = (saved ?? '').split('.')
  const intent: Intent = savedIntent === 'link' ? 'link' : 'login'
  const state = c.req.query('state')
  if (!savedState || !state || state !== savedState) return back(c, '/dang-nhap', 'state')

  const code = c.req.query('code')
  if (!code) return back(c, '/dang-nhap', 'loi')

  const profile = await exchangeCodeForUser(code)
  if (!profile) return back(c, '/dang-nhap', 'loi')

  return intent === 'link' ? await doLink(c, profile) : await doLogin(c, profile)
})

async function doLink(
  c: Parameters<typeof setSessionCookie>[0],
  profile: { id: string; username: string },
): Promise<Response> {
  const me = await resolveSession(readSessionCookie(c))
  // Phiên hết hạn giữa lúc đi vòng qua Discord: về màn đăng nhập, không nuốt im.
  if (!me) return back(c, '/dang-nhap', 'chua_gan')

  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.discordId, profile.id)).limit(1)
  if (taken && taken.id !== me.id) return back(c, '/', 'gan_nguoi_khac')

  await db
    .update(users)
    .set({ discordId: profile.id, discordUsername: profile.username, discordLinkedAt: sql`now()` })
    .where(eq(users.id, me.id))
  await audit(me.id, 'user.discord_link', 'user', me.id, null, { discordId: profile.id })

  return back(c, '/', 'da_gan')
}

async function doLogin(
  c: Parameters<typeof setSessionCookie>[0],
  profile: { id: string; username: string; email: string | null; verified: boolean },
): Promise<Response> {
  const byDiscord = await findLive(eq(users.discordId, profile.id))

  // Lần đầu: chưa gắn thì thử khớp EMAIL ĐÃ XÁC MINH. Chưa xác minh thì bỏ qua hẳn —
  // email chưa xác minh chỉ là chữ người ta tự gõ vào hồ sơ Discord.
  const byEmail =
    byDiscord || !profile.email || !profile.verified ? null : await findLive(eq(users.email, profile.email))

  const user = byDiscord ?? byEmail
  if (!user) return back(c, '/dang-nhap', 'chua_gan')
  if (user.disabled) return back(c, '/dang-nhap', 'bi_khoa')

  // Gắn luôn ở lần khớp email đầu tiên: lần sau đăng nhập bằng discord_id, không
  // còn phụ thuộc vào việc email hai bên có còn trùng nữa.
  if (!byDiscord) {
    await db
      .update(users)
      .set({ discordId: profile.id, discordUsername: profile.username, discordLinkedAt: sql`now()` })
      .where(eq(users.id, user.id))
    await audit(user.id, 'user.discord_link', 'user', user.id, null, { discordId: profile.id, qua: 'email' })
  } else if (user.discordUsername !== profile.username) {
    // Discord cho đổi username; giữ bản mới để màn tài khoản khỏi hiện tên đã cũ.
    await db.update(users).set({ discordUsername: profile.username }).where(eq(users.id, user.id))
  }

  const session = await createSession(user.id, clientIp(c), c.req.header('user-agent') ?? null)
  setSessionCookie(c, session.token, session.maxAgeSec)
  await db.update(users).set({ lastLogin: sql`now()` }).where(eq(users.id, user.id))

  return back(c, '/')
}

async function findLive(where: Parameters<typeof and>[0]) {
  const rows = await db
    .select({
      id: users.id,
      disabled: users.disabled,
      discordUsername: users.discordUsername,
    })
    .from(users)
    .where(and(where, isNull(users.deletedAt)))
    .limit(1)
  return rows[0] ?? null
}

discordRoutes.post('/unlink', requireAuth, async (c) => {
  const me = c.get('user')
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, me.id))
    .limit(1)

  // Không mật khẩu mà bỏ gắn Discord thì mất luôn mọi đường vào tài khoản của chính
  // mình. Chặn ở đây thay vì để người dùng tự phát hiện sau khi đã đăng xuất.
  if (!row?.passwordHash) {
    return errors.badRequest(c, 'Tài khoản này chưa có mật khẩu, bỏ gắn Discord là không còn cách đăng nhập. Đặt mật khẩu trước.')
  }

  await db
    .update(users)
    .set({ discordId: null, discordUsername: null, discordLinkedAt: null })
    .where(eq(users.id, me.id))
  await audit(me.id, 'user.discord_unlink', 'user', me.id, null, null)

  return ok(c, { ok: true })
})
