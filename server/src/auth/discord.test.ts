/**
 * Đăng nhập bằng Discord.
 *
 * Điều được canh gắt nhất ở đây là điều KHÔNG được xảy ra: callback không bao giờ
 * tạo user. Discord là cách xác thực tài khoản đã có, không phải cửa đăng ký — tự
 * tạo user nghĩa là bất kỳ ai có Discord đều vào được judge, và vai trò / ghi danh /
 * team do admin cấp mất hết ý nghĩa. Vì vậy mọi nhánh "không khớp" đều kèm một phép
 * đếm số user trước và sau.
 *
 * Dùng `app.request` thẳng thay vì `call()` của harness: bộ này đọc Location và
 * Set-Cookie, mà `call()` chỉ trả JSON.
 */
import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Chạy TRƯỚC mọi import: `config` chụp env một lần lúc nạp module, nên đặt env trong
// beforeEach là muộn — lúc đó config đã đông cứng với giá trị rỗng.
vi.hoisted(() => {
  process.env.DISCORD_CLIENT_ID = 'client-thu'
  process.env.DISCORD_CLIENT_SECRET = 'secret-thu'
  process.env.DISCORD_REDIRECT_URI = 'http://localhost:8099/auth/discord/callback'
})

import { db, q } from '../db/pool'
import { users } from '../db/schema'
import { INTEGRATION, app, makeUser, resetDb, setupDb, type TestUser } from '../testing/harness'

/** Giả lập hai lượt gọi Discord: đổi code lấy token, rồi hỏi /users/@me. */
function gaLapDiscord(me: Record<string, unknown> | null, tokenOk = true) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.includes('/oauth2/token')) {
      return tokenOk
        ? new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 })
        : new Response('nope', { status: 400 })
    }
    if (url.includes('/users/@me')) {
      return me
        ? new Response(JSON.stringify(me), { status: 200 })
        : new Response('nope', { status: 401 })
    }
    throw new Error(`gọi ngoài dự kiến: ${url}`)
  })
}

/** Bắt đầu luồng: trả state đã ký trong cookie để bước callback dùng lại. */
async function batDau(intent: 'login' | 'link', cookie?: string): Promise<{ state: string; cookie: string }> {
  const res = await app.request(`/auth/discord${intent === 'link' ? '?intent=link' : ''}`, {
    headers: cookie ? { cookie } : {},
  })
  const setCookie = res.headers.get('set-cookie') ?? ''
  const value = /bcn_discord_state=([^;]+)/.exec(setCookie)?.[1] ?? ''
  const state = new URL(res.headers.get('location') ?? 'http://x').searchParams.get('state') ?? ''
  return { state, cookie: `bcn_discord_state=${value}` }
}

const callback = (qs: string, cookie: string) =>
  app.request(`/auth/discord/callback?${qs}`, { headers: { cookie } })

// Location là đường dẫn TƯƠNG ĐỐI (`/dang-nhap?discord=…`) nên `new URL` cần base.
const dich = (res: Response) => new URL(res.headers.get('location') ?? '/', 'http://x')
const lyDo = (res: Response) => dich(res).searchParams.get('discord')
const duongDan = (res: Response) => dich(res).pathname
const coPhien = (res: Response) => /bcn_session=[^;]+/.test(res.headers.get('set-cookie') ?? '')

async function demUser(): Promise<number> {
  const rows = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM users`)
  return rows[0]!.n
}

describe.skipIf(!INTEGRATION)('đăng nhập bằng Discord', () => {
  let member: TestUser

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    vi.restoreAllMocks()
    member = await makeUser('member')
  })

  describe('bắt đầu luồng', () => {
    it('/auth/providers nói tính năng đang bật để màn đăng nhập biết có nên vẽ nút', async () => {
      const res = await app.request('/auth/providers', { headers: { 'x-api-response-version': '2' } })
      const body = (await res.json()) as { data: unknown }
      expect(body.data).toEqual({ discord: true })
    })

    it('đưa sang Discord với đúng client, redirect_uri và scope tối thiểu', async () => {
      const res = await app.request('/auth/discord')
      const url = new URL(res.headers.get('location')!)

      expect(url.origin + url.pathname).toBe('https://discord.com/api/oauth2/authorize')
      expect(url.searchParams.get('client_id')).toBe('client-thu')
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:8099/auth/discord/callback')
      // Chỉ identify + email. Xin thêm `guilds` là xin quyền không dùng đến.
      expect(url.searchParams.get('scope')).toBe('identify email')
    })

    it('state trong URL trùng state trong cookie HttpOnly — đó là toàn bộ lớp chống CSRF', async () => {
      const res = await app.request('/auth/discord')
      const setCookie = res.headers.get('set-cookie')!
      const state = new URL(res.headers.get('location')!).searchParams.get('state')!

      expect(setCookie).toContain(`bcn_discord_state=${state}.login`)
      expect(setCookie).toContain('HttpOnly')
      // Lax chứ KHÔNG Strict: callback là điều hướng từ discord.com sang, Strict thì
      // cookie không được gửi kèm và mọi lần đăng nhập đều hỏng.
      expect(setCookie).toContain('SameSite=Lax')
    })
  })

  describe('chặn ở callback', () => {
    it('state không khớp thì từ chối, không mở phiên', async () => {
      const { cookie } = await batDau('login')
      gaLapDiscord({ id: '1', username: 'ai-do', email: member.email, verified: true })

      const res = await callback('code=abc&state=state-gia', cookie)

      expect(lyDo(res)).toBe('state')
      expect(coPhien(res)).toBe(false)
    })

    it('thiếu hẳn cookie state cũng từ chối — không có cookie thì không có gì để đối chiếu', async () => {
      gaLapDiscord({ id: '1', username: 'ai-do', email: member.email, verified: true })
      const res = await callback('code=abc&state=bat-ky', '')

      expect(lyDo(res)).toBe('state')
      expect(coPhien(res)).toBe(false)
    })

    it('người dùng bấm Cancel ở Discord: nói là đã huỷ, không báo như lỗi hệ thống', async () => {
      const { cookie } = await batDau('login')
      const res = await callback('error=access_denied&state=x', cookie)
      expect(lyDo(res)).toBe('tu_choi')
    })

    it('Discord trả lỗi lúc đổi code thì về màn đăng nhập, không 500 trang trắng', async () => {
      const { state, cookie } = await batDau('login')
      gaLapDiscord(null, false)
      const res = await callback(`code=abc&state=${state}`, cookie)

      expect(lyDo(res)).toBe('loi')
      expect(coPhien(res)).toBe(false)
    })
  })

  describe('KHÔNG BAO GIỜ tạo tài khoản mới', () => {
    it('Discord lạ hoắc: từ chối và số tài khoản không đổi', async () => {
      const truoc = await demUser()
      const { state, cookie } = await batDau('login')
      gaLapDiscord({ id: '999', username: 'nguoi-la', email: 'nguoi-la@gmail.com', verified: true })

      const res = await callback(`code=abc&state=${state}`, cookie)

      expect(lyDo(res)).toBe('chua_gan')
      expect(coPhien(res)).toBe(false)
      expect(await demUser()).toBe(truoc)
    })

    it('email TRÙNG nhưng Discord chưa xác minh email đó: vẫn từ chối', async () => {
      // Email chưa xác minh chỉ là chữ người ta tự gõ vào hồ sơ. Nhận nó nghĩa là ai
      // cũng chiếm được tài khoản người khác bằng cách gõ đúng email của họ.
      const truoc = await demUser()
      const { state, cookie } = await batDau('login')
      gaLapDiscord({ id: '999', username: 'gia-mao', email: member.email, verified: false })

      const res = await callback(`code=abc&state=${state}`, cookie)

      expect(lyDo(res)).toBe('chua_gan')
      expect(coPhien(res)).toBe(false)
      expect(await demUser()).toBe(truoc)
    })
  })

  describe('đăng nhập được', () => {
    it('Discord đã gắn sẵn thì vào thẳng', async () => {
      await db.update(users).set({ discordId: '42', discordUsername: 'cu' }).where(sql`id = ${member.id}`)
      const { state, cookie } = await batDau('login')
      gaLapDiscord({ id: '42', username: 'moi', email: null, verified: false })

      const res = await callback(`code=abc&state=${state}`, cookie)

      expect(duongDan(res)).toBe('/')
      expect(lyDo(res)).toBeNull()
      expect(coPhien(res)).toBe(true)
    })

    it('ảnh Discord vào DB dạng HASH, và /auth/me trả URL dựng sẵn', async () => {
      await db.update(users).set({ discordId: '42' }).where(sql`id = ${member.id}`)
      const { state, cookie } = await batDau('login')
      gaLapDiscord({ id: '42', username: 'x', email: null, verified: false, avatar: 'abc123' })
      const res = await callback(`code=abc&state=${state}`, cookie)

      const rows = await q<{ a: string }>(sql`SELECT discord_avatar AS a FROM users WHERE id = ${member.id}`)
      // Lưu hash, KHÔNG lưu URL: URL do CDN của Discord quy định, họ đổi lúc nào cũng được.
      expect(rows[0]!.a).toBe('abc123')

      const phien = /bcn_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')![1]
      const me = await app.request('/auth/me', {
        headers: { cookie: `bcn_session=${phien}`, 'x-api-response-version': '2' },
      })
      const body = (await me.json()) as { data: { avatarUrl: string } }
      expect(body.data.avatarUrl).toBe('https://cdn.discordapp.com/avatars/42/abc123.png?size=64')
    })

    it('đổi ảnh giữa hai lần đăng nhập thì hash được làm mới', async () => {
      await db.update(users).set({ discordId: '42', discordAvatar: 'anh_cu' }).where(sql`id = ${member.id}`)
      const { state, cookie } = await batDau('login')
      gaLapDiscord({ id: '42', username: 'x', email: null, verified: false, avatar: 'anh_moi' })
      await callback(`code=abc&state=${state}`, cookie)

      const rows = await q<{ a: string }>(sql`SELECT discord_avatar AS a FROM users WHERE id = ${member.id}`)
      expect(rows[0]!.a).toBe('anh_moi')
    })

    it('để ảnh mặc định của Discord thì không có hash — giao diện lùi về chữ cái đầu', async () => {
      await db.update(users).set({ discordId: '42' }).where(sql`id = ${member.id}`)
      const { state, cookie } = await batDau('login')
      gaLapDiscord({ id: '42', username: 'x', email: null, verified: false, avatar: null })
      await callback(`code=abc&state=${state}`, cookie)

      const rows = await q<{ a: string | null }>(sql`SELECT discord_avatar AS a FROM users WHERE id = ${member.id}`)
      expect(rows[0]!.a).toBeNull()
    })

    it('username Discord đổi thì cập nhật theo — định danh là id, tên chỉ để hiện', async () => {
      await db.update(users).set({ discordId: '42', discordUsername: 'ten-cu' }).where(sql`id = ${member.id}`)
      const { state, cookie } = await batDau('login')
      gaLapDiscord({ id: '42', username: 'ten-moi', email: null, verified: false })
      await callback(`code=abc&state=${state}`, cookie)

      const rows = await q<{ u: string }>(sql`SELECT discord_username AS u FROM users WHERE id = ${member.id}`)
      expect(rows[0]!.u).toBe('ten-moi')
    })

    it('lần đầu: email ĐÃ XÁC MINH trùng thì gắn luôn, lần sau không cần email nữa', async () => {
      const truoc = await demUser()
      const { state, cookie } = await batDau('login')
      gaLapDiscord({ id: '77', username: 'chinh-chu', email: member.email, verified: true })

      const res = await callback(`code=abc&state=${state}`, cookie)

      expect(coPhien(res)).toBe(true)
      expect(await demUser()).toBe(truoc)
      const rows = await q<{ d: string }>(sql`SELECT discord_id AS d FROM users WHERE id = ${member.id}`)
      expect(rows[0]!.d).toBe('77')
    })

    it('tài khoản bị khoá thì Discord cũng không mở được', async () => {
      await db.update(users).set({ discordId: '42', disabled: true }).where(sql`id = ${member.id}`)
      const { state, cookie } = await batDau('login')
      gaLapDiscord({ id: '42', username: 'x', email: null, verified: false })

      const res = await callback(`code=abc&state=${state}`, cookie)

      expect(lyDo(res)).toBe('bi_khoa')
      expect(coPhien(res)).toBe(false)
    })
  })

  describe('gắn và bỏ gắn', () => {
    it('đang đăng nhập thì gắn được Discord vào chính tài khoản mình', async () => {
      const { state, cookie } = await batDau('link', member.cookie)
      gaLapDiscord({ id: '55', username: 'toi', email: null, verified: false })

      const res = await callback(`code=abc&state=${state}`, `${cookie}; ${member.cookie}`)

      expect(lyDo(res)).toBe('da_gan')
      const rows = await q<{ d: string }>(sql`SELECT discord_id AS d FROM users WHERE id = ${member.id}`)
      expect(rows[0]!.d).toBe('55')
    })

    it('một Discord không gắn được vào hai tài khoản', async () => {
      const nguoiKhac = await makeUser('member')
      await db.update(users).set({ discordId: '55' }).where(sql`id = ${nguoiKhac.id}`)

      const { state, cookie } = await batDau('link', member.cookie)
      gaLapDiscord({ id: '55', username: 'toi', email: null, verified: false })
      const res = await callback(`code=abc&state=${state}`, `${cookie}; ${member.cookie}`)

      expect(lyDo(res)).toBe('gan_nguoi_khac')
      const rows = await q<{ d: string | null }>(sql`SELECT discord_id AS d FROM users WHERE id = ${member.id}`)
      expect(rows[0]!.d).toBeNull()
    })

    it('bỏ gắn thì xoá sạch dấu vết Discord', async () => {
      await db
        .update(users)
        .set({ discordId: '42', discordUsername: 'x', discordAvatar: 'abc' })
        .where(sql`id = ${member.id}`)
      const res = await app.request('/auth/discord/unlink', {
        method: 'POST',
        headers: { cookie: member.cookie, 'x-api-response-version': '2' },
      })

      expect(res.status).toBe(200)
      const rows = await q<{ d: string | null; u: string | null; a: string | null }>(
        sql`SELECT discord_id AS d, discord_username AS u, discord_avatar AS a FROM users WHERE id = ${member.id}`,
      )
      // Cả ảnh cũng phải đi: bỏ gắn mà còn ảnh Discord nằm lại là còn dấu vết.
      expect(rows[0]).toEqual({ d: null, u: null, a: null })
    })

    it('tài khoản KHÔNG có mật khẩu thì chặn bỏ gắn — bỏ xong là mất đường vào', async () => {
      await db
        .update(users)
        .set({ discordId: '42', passwordHash: null, hashAlgo: null })
        .where(sql`id = ${member.id}`)

      const res = await app.request('/auth/discord/unlink', {
        method: 'POST',
        headers: { cookie: member.cookie, 'x-api-response-version': '2' },
      })

      expect(res.status).toBe(400)
      const rows = await q<{ d: string | null }>(sql`SELECT discord_id AS d FROM users WHERE id = ${member.id}`)
      expect(rows[0]!.d).toBe('42')
    })
  })
})

/**
 * Tự đổi tên hiển thị (PATCH /auth/me).
 *
 * Nằm cùng file với Discord vì điểm đáng canh nhất là chỗ hai thứ gặp nhau: tên do
 * người dùng tự đặt KHÔNG được bị lần đăng nhập Discord sau đó ghi đè bằng username
 * Discord. Đổi tên xong mà hôm sau đăng nhập lại thấy tên cũ là lỗi câm.
 */
describe.skipIf(!INTEGRATION)('đổi tên hiển thị', () => {
  let member: TestUser

  beforeAll(async () => {
    await setupDb()
  })
  beforeEach(async () => {
    await resetDb()
    vi.restoreAllMocks()
    member = await makeUser('member')
  })

  const doiTen = (displayName: unknown, as = member) =>
    app.request('/auth/me', {
      method: 'PATCH',
      headers: { cookie: as.cookie, 'content-type': 'application/json', 'x-api-response-version': '2' },
      body: JSON.stringify({ displayName }),
    })

  const tenTrongDb = async (id: string) =>
    (await q<{ n: string }>(sql`SELECT display_name AS n FROM users WHERE id = ${id}`))[0]!.n

  it('đổi được, và /auth/me trả tên mới ngay', async () => {
    const res = await doiTen('Bùi Thu Ngọc')
    expect(res.status).toBe(200)
    expect(await tenTrongDb(member.id)).toBe('Bùi Thu Ngọc')

    const me = await app.request('/auth/me', {
      headers: { cookie: member.cookie, 'x-api-response-version': '2' },
    })
    expect(((await me.json()) as { data: { displayName: string } }).data.displayName).toBe('Bùi Thu Ngọc')
  })

  it('cắt khoảng trắng hai đầu', async () => {
    await doiTen('   Ngọc   ')
    expect(await tenTrongDb(member.id)).toBe('Ngọc')
  })

  it('tên toàn khoảng trắng bị từ chối — nó qua được min(1) nhưng hiện ra là ô trống', async () => {
    const truoc = await tenTrongDb(member.id)
    expect((await doiTen('     ')).status).toBe(400)
    expect(await tenTrongDb(member.id)).toBe(truoc)
  })

  it('tên rỗng và tên quá dài đều bị từ chối', async () => {
    expect((await doiTen('')).status).toBe(400)
    expect((await doiTen('x'.repeat(201))).status).toBe(400)
  })

  it('chưa đăng nhập thì không đổi được tên của ai cả', async () => {
    const res = await app.request('/auth/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-api-response-version': '2' },
      body: JSON.stringify({ displayName: 'Kẻ lạ' }),
    })
    expect(res.status).toBe(401)
  })

  it('KHÔNG đổi được vai trò hay email qua đường này', async () => {
    await app.request('/auth/me', {
      method: 'PATCH',
      headers: { cookie: member.cookie, 'content-type': 'application/json', 'x-api-response-version': '2' },
      body: JSON.stringify({ displayName: 'Ngọc', role: 'admin', email: 'hacker@x.com' }),
    })
    const row = (
      await q<{ r: string; e: string }>(sql`SELECT role AS r, email AS e FROM users WHERE id = ${member.id}`)
    )[0]!
    expect(row.r).toBe('member')
    expect(row.e).toBe(member.email)
  })

  it('đăng nhập Discord sau đó KHÔNG ghi đè tên tự đặt', async () => {
    await db.update(users).set({ discordId: '42', discordUsername: 'ten_discord' }).where(sql`id = ${member.id}`)
    await doiTen('Tên tôi tự đặt')

    const start = await app.request('/auth/discord')
    const value = /bcn_discord_state=([^;]+)/.exec(start.headers.get('set-cookie') ?? '')?.[1] ?? ''
    const state = new URL(start.headers.get('location')!).searchParams.get('state')!
    gaLapDiscord({ id: '42', username: 'ten_discord_moi', email: null, verified: false, avatar: null })
    await app.request(`/auth/discord/callback?code=abc&state=${state}`, {
      headers: { cookie: `bcn_discord_state=${value}` },
    })

    // discord_username theo Discord, còn display_name là của người dùng.
    expect(await tenTrongDb(member.id)).toBe('Tên tôi tự đặt')
    const row = (await q<{ u: string }>(sql`SELECT discord_username AS u FROM users WHERE id = ${member.id}`))[0]!
    expect(row.u).toBe('ten_discord_moi')
  })
})
