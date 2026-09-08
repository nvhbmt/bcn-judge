/**
 * Cổng theo server Discord: ai ở trong guild thì được TẠO tài khoản và vào thẳng.
 *
 * File riêng với `discord.test.ts` vì `config` chụp env một lần lúc nạp module —
 * cổng bật và cổng tắt là hai thế giới, không sống chung một file được.
 *
 * Đây là chỗ đổi CHÍNH SÁCH TRUY CẬP của cả hệ (từ "admin cấp từng tài khoản" sang
 * "ai vào được server Discord"), nên bộ test này canh cả hai chiều: đúng người thì
 * vào được, và sai người thì không có đường nào lọt.
 */
import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DISCORD_CLIENT_ID = 'client-thu'
  process.env.DISCORD_CLIENT_SECRET = 'secret-thu'
  process.env.DISCORD_REDIRECT_URI = 'http://localhost:8099/auth/discord/callback'
  process.env.DISCORD_GUILD_ID = '111222333'
  process.env.DISCORD_ROLE_ID = '999888'
})

import { db, q } from '@/db/pool'
import { users } from '@/db/schema'
import { INTEGRATION, app, makeUser, resetDb, setupDb, type TestUser } from '@/testing/harness'

type GuildTraLoi = { roles: string[] } | 404 | 'loi'

function gaLapDiscord(me: Record<string, unknown>, guild: GuildTraLoi) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.includes('/oauth2/token')) return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 })
    if (url.includes('/guilds/') && url.includes('/member')) {
      if (guild === 'loi') throw new Error('mạng hỏng')
      if (guild === 404) return new Response('not a member', { status: 404 })
      return new Response(JSON.stringify({ roles: guild.roles }), { status: 200 })
    }
    if (url.includes('/users/@me')) return new Response(JSON.stringify(me), { status: 200 })
    throw new Error(`gọi ngoài dự kiến: ${url}`)
  })
}

async function batDau(): Promise<{ state: string; cookie: string }> {
  const res = await app.request('/auth/discord')
  const value = /bcn_discord_state=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1] ?? ''
  const state = new URL(res.headers.get('location') ?? 'http://x').searchParams.get('state') ?? ''
  return { state, cookie: `bcn_discord_state=${value}` }
}

async function dangNhap(me: Record<string, unknown>, guild: GuildTraLoi, cookieThem = '') {
  const { state, cookie } = await batDau()
  gaLapDiscord(me, guild)
  return app.request(`/auth/discord/callback?code=abc&state=${state}`, {
    headers: { cookie: cookieThem ? `${cookie}; ${cookieThem}` : cookie },
  })
}

const dich = (res: Response) => new URL(res.headers.get('location') ?? '/', 'http://x')
const lyDo = (res: Response) => dich(res).searchParams.get('discord')
const coPhien = (res: Response) => /bcn_session=[^;]+/.test(res.headers.get('set-cookie') ?? '')
const demUser = async () => (await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM users`))[0]!.n

const TRONG_GUILD: GuildTraLoi = { roles: ['999888', '123'] }
const NGUOI_LA = { id: '77', username: 'nguoi_moi', email: 'moi@gmail.com', verified: true }

describe.skipIf(!INTEGRATION)('cổng theo server Discord', () => {
  let member: TestUser

  beforeAll(async () => {
    await setupDb()
  })
  beforeEach(async () => {
    await resetDb()
    vi.restoreAllMocks()
    member = await makeUser('member')
  })

  it('xin thêm scope guilds.members.read — và CHỈ khi cổng bật', async () => {
    const res = await app.request('/auth/discord')
    const scope = new URL(res.headers.get('location')!).searchParams.get('scope')
    // `guilds.members.read` chứ không phải `guilds`: `guilds` trả về danh sách MỌI
    // server người đó tham gia, dữ liệu riêng tư không liên quan tới việc họ có ở CLB.
    expect(scope).toBe('identify email guilds.members.read')
  })

  describe('người trong guild', () => {
    it('chưa có tài khoản thì được TẠO và vào thẳng', async () => {
      const truoc = await demUser()
      const res = await dangNhap(NGUOI_LA, TRONG_GUILD)

      expect(dich(res).pathname).toBe('/')
      expect(coPhien(res)).toBe(true)
      expect(await demUser()).toBe(truoc + 1)
    })

    it('tài khoản sinh ra luôn là member, không mật khẩu, và KHÔNG bị bắt đổi mật khẩu', async () => {
      await dangNhap(NGUOI_LA, TRONG_GUILD)
      const row = (
        await q<{ role: string; ph: string | null; mcp: boolean; email: string }>(
          sql`SELECT role, password_hash AS ph, must_change_password AS mcp, email FROM users WHERE discord_id = '77'`,
        )
      )[0]!

      // Không có đường nào để một cú đăng nhập Discord sinh ra mentor/admin.
      expect(row.role).toBe('member')
      expect(row.ph).toBeNull()
      // Cột mặc định là true, mà tài khoản này KHÔNG CÓ mật khẩu để đổi — để true thì
      // middleware chặn mọi API và người ta kẹt ở màn đổi mật khẩu vĩnh viễn.
      expect(row.mcp).toBe(false)
      expect(row.email).toBe('moi@gmail.com')
    })

    it('tên HIỂN THỊ lấy từ global_name, KHÔNG phải username (handle)', async () => {
      // Bug người dùng gặp: tài khoản mới hiện "nguyen_minh_anh" (handle) thay vì
      // "Nguyễn Minh Anh". username là khoá định danh viết thường, global_name mới
      // là tên người ta tự đặt để hiện.
      await dangNhap(
        { id: '88', username: 'nguyen_minh_anh', global_name: 'Nguyễn Minh Anh', email: 'a@gmail.com', verified: true },
        TRONG_GUILD,
      )
      const row = (
        await q<{ dn: string; du: string }>(
          sql`SELECT display_name AS dn, discord_username AS du FROM users WHERE discord_id = '88'`,
        )
      )[0]!
      expect(row.dn).toBe('Nguyễn Minh Anh')
      // Handle vẫn được giữ ở discord_username (màn tài khoản hiện "đang gắn: …").
      expect(row.du).toBe('nguyen_minh_anh')
    })

    it('tài khoản Discord chưa đặt tên hiển thị thì rơi về username', async () => {
      await dangNhap(
        { id: '89', username: 'chi_co_handle', global_name: null, email: 'b@gmail.com', verified: true },
        TRONG_GUILD,
      )
      const dn = (await q<{ dn: string }>(sql`SELECT display_name AS dn FROM users WHERE discord_id = '89'`))[0]!.dn
      expect(dn).toBe('chi_co_handle')
    })

    it('không được ghi danh khoá nào — "được vào nhà" khác "được vào lớp"', async () => {
      await dangNhap(NGUOI_LA, TRONG_GUILD)
      const n = (
        await q<{ n: number }>(
          sql`SELECT count(*)::int AS n FROM course_enrollments e
              JOIN users u ON u.id = e.user_id WHERE u.discord_id = '77'`,
        )
      )[0]!.n
      expect(n).toBe(0)
    })

    it('Discord không cho email thì dựng khoá định danh, không để trống', async () => {
      await dangNhap({ id: '78', username: 'khong_email', email: null, verified: false }, TRONG_GUILD)
      const row = (await q<{ email: string }>(sql`SELECT email FROM users WHERE discord_id = '78'`))[0]!
      expect(row.email).toBe('discord-78@discord.local')
    })

    it('email đã xác minh trùng người có sẵn thì GẮN, không tạo trùng một người', async () => {
      const truoc = await demUser()
      const res = await dangNhap(
        { id: '79', username: 'chinh_chu', email: member.email, verified: true },
        TRONG_GUILD,
      )

      expect(coPhien(res)).toBe(true)
      expect(await demUser()).toBe(truoc)
      const row = (await q<{ d: string }>(sql`SELECT discord_id AS d FROM users WHERE id = ${member.id}`))[0]!
      expect(row.d).toBe('79')
    })
  })

  describe('người KHÔNG qua cổng', () => {
    it('ngoài guild: chặn, và không tạo ai', async () => {
      const truoc = await demUser()
      const res = await dangNhap(NGUOI_LA, 404)

      expect(lyDo(res)).toBe('ngoai_server')
      expect(coPhien(res)).toBe(false)
      expect(await demUser()).toBe(truoc)
    })

    it('trong guild nhưng thiếu vai trò: chặn, và nói đúng lý do đó', async () => {
      const truoc = await demUser()
      const res = await dangNhap(NGUOI_LA, { roles: ['123'] })

      // Khác 'ngoai_server': họ đã ở trong server rồi, việc cần làm là xin vai trò.
      expect(lyDo(res)).toBe('thieu_vai_tro')
      expect(await demUser()).toBe(truoc)
    })

    it('hỏi Discord không được thì ĐÓNG, không mở — và nói rõ là chưa kiểm được', async () => {
      // Gộp "không phải thành viên" với "không hỏi được" là sai cả hai chiều: gộp
      // thành mở thì một sự cố mạng mở toang cổng; gộp thành 'ngoai_server' thì báo
      // oan người đang ở trong server. Nên có mã riêng, và mã đó CHẶN.
      const truoc = await demUser()
      const res = await dangNhap(NGUOI_LA, 'loi')

      expect(lyDo(res)).toBe('khong_kiem_duoc')
      expect(coPhien(res)).toBe(false)
      expect(await demUser()).toBe(truoc)
    })
  })

  describe('cổng áp cho ai', () => {
    it('tài khoản admin cấp (có mật khẩu) KHÔNG bị cổng chặn, dù đã rời server', async () => {
      // Admin đã đứng ra bảo lãnh khi tạo tài khoản. Chặn ở đây thì một mentor rời
      // server Discord sẽ mất luôn nút đăng nhập, dù tài khoản vẫn hợp lệ.
      await db.update(users).set({ discordId: '42' }).where(sql`id = ${member.id}`)
      const res = await dangNhap({ id: '42', username: 'x', email: null, verified: false }, 404)

      expect(dich(res).pathname).toBe('/')
      expect(coPhien(res)).toBe(true)
    })

    it('tài khoản do CỔNG sinh ra (không mật khẩu) mà rời server thì mất quyền vào', async () => {
      await dangNhap(NGUOI_LA, TRONG_GUILD)
      vi.restoreAllMocks()
      const res = await dangNhap(NGUOI_LA, 404)

      expect(lyDo(res)).toBe('ngoai_server')
      expect(coPhien(res)).toBe(false)
    })
  })

  describe('bị bộ quét khoá vì rời server (auth/discordSweep.ts)', () => {
    const khoaBoiQuet = (id: string) =>
      db
        .update(users)
        .set({ disabled: true, disabledReason: 'discord_kick', disabledAt: sql`now()` })
        .where(sql`id = ${id}`)
    const trangThai = async (id: string) =>
      (await q<{ d: boolean; r: string | null }>(sql`SELECT disabled AS d, disabled_reason AS r FROM users WHERE id = ${id}`))[0]!

    it('vào lại server rồi đăng nhập Discord → tự mở khoá, có phiên, ghi audit', async () => {
      await dangNhap(NGUOI_LA, TRONG_GUILD)
      vi.restoreAllMocks()
      const [u] = await q<{ id: string }>(sql`SELECT id FROM users WHERE discord_id = '77'`)
      await khoaBoiQuet(u!.id)

      const res = await dangNhap(NGUOI_LA, TRONG_GUILD)
      expect(dich(res).pathname).toBe('/')
      expect(coPhien(res)).toBe(true)
      expect(await trangThai(u!.id)).toEqual({ d: false, r: null })
      const [a] = await q(sql`SELECT 1 FROM audit_log WHERE action = 'user.auto_unlock' AND entity_id = ${u!.id}`)
      expect(a).toBeDefined()
    })

    it('vẫn ngoài server → chặn với lý do RỜI SERVER, không phải "bị khoá" chung chung', async () => {
      await dangNhap(NGUOI_LA, TRONG_GUILD)
      vi.restoreAllMocks()
      const [u] = await q<{ id: string }>(sql`SELECT id FROM users WHERE discord_id = '77'`)
      await khoaBoiQuet(u!.id)

      const res = await dangNhap(NGUOI_LA, 404)
      expect(lyDo(res)).toBe('roi_server')
      expect(coPhien(res)).toBe(false)
      expect((await trangThai(u!.id)).d).toBe(true)
    })

    it('tài khoản CÓ mật khẩu bị quét khoá (cờ mở rộng) cũng phải qua cổng mới được mở', async () => {
      await db.update(users).set({ discordId: '42' }).where(sql`id = ${member.id}`)
      await khoaBoiQuet(member.id)

      // Chưa vào lại server: dù có mật khẩu — thứ bình thường miễn cổng — vẫn bị chặn.
      const chan = await dangNhap({ id: '42', username: 'x', email: null, verified: false }, 404)
      expect(lyDo(chan)).toBe('roi_server')
      expect((await trangThai(member.id)).d).toBe(true)

      vi.restoreAllMocks()
      const mo = await dangNhap({ id: '42', username: 'x', email: null, verified: false }, TRONG_GUILD)
      expect(coPhien(mo)).toBe(true)
      expect((await trangThai(member.id)).d).toBe(false)
    })

    it('admin khoá TAY thì Discord không mở, dù đang ở trong server', async () => {
      await db
        .update(users)
        .set({ discordId: '42', disabled: true, disabledReason: 'admin', disabledAt: sql`now()` })
        .where(sql`id = ${member.id}`)
      const res = await dangNhap({ id: '42', username: 'x', email: null, verified: false }, TRONG_GUILD)
      expect(lyDo(res)).toBe('bi_khoa')
      expect(coPhien(res)).toBe(false)
      expect((await trangThai(member.id)).d).toBe(true)
    })

    it('hỏi Discord không được thì giữ nguyên khoá và nói "chưa kiểm được"', async () => {
      await dangNhap(NGUOI_LA, TRONG_GUILD)
      vi.restoreAllMocks()
      const [u] = await q<{ id: string }>(sql`SELECT id FROM users WHERE discord_id = '77'`)
      await khoaBoiQuet(u!.id)
      const res = await dangNhap(NGUOI_LA, 'loi')
      expect(lyDo(res)).toBe('khong_kiem_duoc')
      expect((await trangThai(u!.id)).d).toBe(true)
    })
  })
})
