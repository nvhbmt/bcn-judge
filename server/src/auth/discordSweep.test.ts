/**
 * Bộ quét khoá tài khoản khi rời server Discord.
 *
 * Hai tầng: `diffKicked` / `tooManyToLock` là hàm thuần (chạy không cần gì), còn
 * `sweepDiscordKicks` chạy trên DB thật với Discord giả lập. Điều được canh gắt nhất
 * là những lượt KHÔNG được khoá ai: Discord hỏng, danh sách rỗng, hay danh sách thiếu
 * tới mức "cả server bỏ đi" — một bộ quét khoá nhầm cả ban nguy hiểm hơn một bộ quét
 * không chạy.
 */
import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DISCORD_CLIENT_ID = 'client-thu'
  process.env.DISCORD_CLIENT_SECRET = 'secret-thu'
  process.env.DISCORD_REDIRECT_URI = 'http://localhost:8099/auth/discord/callback'
  process.env.DISCORD_GUILD_ID = '111222333'
  process.env.DISCORD_ROLE_ID = '999888'
  process.env.DISCORD_BOT_TOKEN = 'bot-thu'
})

import { createSession, resolveSession } from './session'
import { fetchGuildMembers } from './discordApi'
import {
  SWEEP_LAST_KEY,
  diffKicked,
  sweepDiscordKicks,
  sweepDiscordKicksExclusive,
  sweepEnabled,
  tooManyToLock,
} from './discordSweep'
import { db, q } from '@/db/pool'
import { users } from '@/db/schema'
import { setSetting } from '@/lib/settings'
import { INTEGRATION, makeUser, resetDb, setupDb } from '@/testing/harness'

const CO_VAI_TRO = ['999888', '1']

describe('diffKicked — luật "ai bị khoá"', () => {
  const tk = (id: string, discordId: string, hasPassword = false) => ({ id, discordId, hasPassword })

  it('không còn trong danh sách → rời server', () => {
    const out = diffKicked([tk('a', '1'), tk('b', '2')], [{ id: '1', roles: CO_VAI_TRO }], {
      roleId: '999888',
      lockPasswordAccounts: false,
    })
    expect(out).toEqual([{ account: tk('b', '2'), reason: 'roi_server' }])
  })

  it('còn trong server nhưng mất vai trò → thiếu vai trò; không cấu hình role thì không xét', () => {
    const members = [{ id: '1', roles: ['1'] }]
    expect(diffKicked([tk('a', '1')], members, { roleId: '999888', lockPasswordAccounts: false })).toEqual([
      { account: tk('a', '1'), reason: 'thieu_vai_tro' },
    ])
    expect(diffKicked([tk('a', '1')], members, { roleId: '', lockPasswordAccounts: false })).toEqual([])
  })

  it('tài khoản CÓ mật khẩu chỉ bị xét khi bật cờ mở rộng', () => {
    const acc = [tk('a', '1', true)]
    expect(diffKicked(acc, [], { roleId: '', lockPasswordAccounts: false })).toEqual([])
    expect(diffKicked(acc, [], { roleId: '', lockPasswordAccounts: true })).toHaveLength(1)
  })
})

describe('tooManyToLock — lan can chống danh sách thiếu', () => {
  it('tối đa hai người thì luôn cho; hơn thế thì không quá nửa', () => {
    expect(tooManyToLock(1, 1)).toBe(false)
    expect(tooManyToLock(2, 2)).toBe(false)
    expect(tooManyToLock(3, 3)).toBe(true)
    expect(tooManyToLock(2, 4)).toBe(false)
    expect(tooManyToLock(3, 4)).toBe(true)
    expect(tooManyToLock(50, 100)).toBe(false)
    expect(tooManyToLock(51, 100)).toBe(true)
  })
})

describe('fetchGuildMembers — phân trang bằng bot token', () => {
  it('trang đầy 1000 thì hỏi tiếp với after = id cuối; trang vơi thì dừng', async () => {
    const urls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      urls.push(url)
      expect((init?.headers as Record<string, string>).authorization).toBe('Bot bot-thu')
      const after = new URL(url).searchParams.get('after')
      const page =
        after === '0'
          ? Array.from({ length: 1000 }, (_, i) => ({ user: { id: String(i + 1) }, roles: [] }))
          : [{ user: { id: '5000' }, roles: ['r'] }]
      return new Response(JSON.stringify(page), { status: 200 })
    })
    const members = await fetchGuildMembers('bot-thu', '111222333')
    expect(members).not.toBe('loi')
    expect((members as { id: string }[]).length).toBe(1001)
    expect(urls[1]).toContain('after=1000')
    vi.restoreAllMocks()
  })

  it('403 (thiếu Server Members Intent) hay body lạ → loi, không trả nửa danh sách', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no intent', { status: 403 }))
    expect(await fetchGuildMembers('bot-thu', '111222333')).toBe('loi')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ oops: 1 }), { status: 200 }))
    expect(await fetchGuildMembers('bot-thu', '111222333')).toBe('loi')
    vi.restoreAllMocks()
  })
})

// ─────────────────────────────────────────────── trên DB thật, Discord giả lập

type Danh = { user: { id: string }; roles: string[] }[] | 'loi' | 403

function gaLapDanhSach(tra: Danh) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (!url.includes('/guilds/111222333/members')) throw new Error(`gọi ngoài dự kiến: ${url}`)
    if (tra === 'loi') throw new Error('mạng hỏng')
    if (tra === 403) return new Response('no intent', { status: 403 })
    return new Response(JSON.stringify(tra), { status: 200 })
  })
}

/** Tài khoản kiểu "do cổng sinh ra": gắn Discord, KHÔNG mật khẩu. Kèm một phiên đang mở. */
async function taiKhoanCong(discordId: string): Promise<{ id: string; token: string }> {
  const [row] = await db
    .insert(users)
    .values({
      email: `discord-${discordId}@discord.local`,
      displayName: `dc ${discordId}`,
      role: 'member',
      passwordHash: null,
      mustChangePassword: false,
      discordId,
      discordLinkedAt: sql`now()`,
    })
    .returning({ id: users.id })
  const s = await createSession(row!.id, null, 'vitest')
  return { id: row!.id, token: s.token }
}

const trangThai = async (id: string) =>
  (
    await q<{ disabled: boolean; reason: string | null; at: string | null }>(
      sql`SELECT disabled, disabled_reason AS reason, disabled_at AS at FROM users WHERE id = ${id}`,
    )
  )[0]!

const thanhVien = (...ids: string[]) => ids.map((id) => ({ user: { id }, roles: CO_VAI_TRO }))

describe.skipIf(!INTEGRATION)('sweepDiscordKicks', () => {
  beforeAll(async () => {
    await setupDb()
  })
  beforeEach(async () => {
    await resetDb()
    vi.restoreAllMocks()
  })

  it('bật khi có đủ cổng guild + bot token', () => {
    expect(sweepEnabled()).toBe(true)
  })

  it('rời server → khoá, cắt phiên, ghi audit không có người thực hiện, ghi kết quả lượt', async () => {
    const con = await taiKhoanCong('10')
    const di = await taiKhoanCong('11')
    gaLapDanhSach(thanhVien('10'))

    const r = await sweepDiscordKicks()
    expect(r).toMatchObject({ checked: 2, locked: 1, skipped: null })

    expect(await trangThai(con.id)).toMatchObject({ disabled: false, reason: null })
    const bi = await trangThai(di.id)
    expect(bi.disabled).toBe(true)
    expect(bi.reason).toBe('discord_kick')
    expect(bi.at).not.toBeNull()
    // Phiên đang mở bị cắt ngay — không chờ hết 30 ngày.
    expect(await resolveSession(di.token)).toBeNull()
    expect(await resolveSession(con.token)).not.toBeNull()

    const [audit] = await q<{ actor: string | null; after: { reason: string } }>(
      sql`SELECT actor_id AS actor, after FROM audit_log WHERE action = 'user.auto_lock' AND entity_id = ${di.id}`,
    )
    expect(audit?.actor).toBeNull()
    expect(audit?.after.reason).toBe('roi_server')

    const [last] = await q<{ value: { locked: number } }>(sql`SELECT value FROM settings WHERE key = ${SWEEP_LAST_KEY}`)
    expect(last?.value.locked).toBe(1)
  })

  it('mất vai trò cũng là rời — ghi đúng lý do', async () => {
    const tk = await taiKhoanCong('12')
    gaLapDanhSach([{ user: { id: '12' }, roles: ['khac'] }])
    await sweepDiscordKicks()
    expect((await trangThai(tk.id)).disabled).toBe(true)
    const [audit] = await q<{ after: { reason: string } }>(
      sql`SELECT after FROM audit_log WHERE action = 'user.auto_lock' AND entity_id = ${tk.id}`,
    )
    expect(audit?.after.reason).toBe('thieu_vai_tro')
  })

  it('tài khoản admin cấp (có mật khẩu) KHÔNG bị đụng — trừ khi admin bật cờ mở rộng', async () => {
    const mentor = await makeUser('mentor')
    await db.update(users).set({ discordId: '20' }).where(sql`id = ${mentor.id}`)
    gaLapDanhSach([])
    // Danh sách rỗng bị coi là lỗi (lan can 2) — cho một người lạ vào để có danh sách thật.
    gaLapDanhSach(thanhVien('999'))

    expect(await sweepDiscordKicks()).toMatchObject({ checked: 0, locked: 0, skipped: null })
    expect((await trangThai(mentor.id)).disabled).toBe(false)

    await setSetting('discord_kick_locks_password_accounts', true, null)
    expect(await sweepDiscordKicks()).toMatchObject({ checked: 1, locked: 1 })
    expect(await trangThai(mentor.id)).toMatchObject({ disabled: true, reason: 'discord_kick' })
  })

  it('hỏi Discord không được → bỏ lượt, KHÔNG khoá ai, vẫn ghi lại lý do bỏ', async () => {
    const tk = await taiKhoanCong('30')
    gaLapDanhSach('loi')
    expect(await sweepDiscordKicks()).toMatchObject({ locked: 0, skipped: 'discord_loi' })
    gaLapDanhSach(403)
    expect(await sweepDiscordKicks()).toMatchObject({ locked: 0, skipped: 'discord_loi' })
    expect((await trangThai(tk.id)).disabled).toBe(false)
    const [last] = await q<{ value: { skipped: string } }>(sql`SELECT value FROM settings WHERE key = ${SWEEP_LAST_KEY}`)
    expect(last?.value.skipped).toBe('discord_loi')
  })

  it('danh sách rỗng bị coi là lỗi — một server không có ai là chuyện không có thật', async () => {
    const tk = await taiKhoanCong('31')
    gaLapDanhSach([])
    expect(await sweepDiscordKicks()).toMatchObject({ locked: 0, skipped: 'danh_sach_rong' })
    expect((await trangThai(tk.id)).disabled).toBe(false)
  })

  it('định khoá quá nửa (và hơn hai người) → huỷ lượt; đúng nửa thì làm', async () => {
    const a = await taiKhoanCong('40')
    const b = await taiKhoanCong('41')
    const c = await taiKhoanCong('42')
    const d = await taiKhoanCong('43')
    gaLapDanhSach(thanhVien('40'))
    expect(await sweepDiscordKicks()).toMatchObject({ checked: 4, locked: 0, skipped: 'qua_nua' })
    for (const tk of [a, b, c, d]) expect((await trangThai(tk.id)).disabled).toBe(false)

    vi.restoreAllMocks()
    gaLapDanhSach(thanhVien('40', '41'))
    expect(await sweepDiscordKicks()).toMatchObject({ checked: 4, locked: 2, skipped: null })
    expect((await trangThai(c.id)).disabled).toBe(true)
    expect((await trangThai(d.id)).disabled).toBe(true)
  })

  it('không khoá lại người đã bị khoá, và không ghi đè lý do khoá tay của admin', async () => {
    const tk = await taiKhoanCong('50')
    await db
      .update(users)
      .set({ disabled: true, disabledReason: 'admin', disabledAt: sql`now()` })
      .where(sql`id = ${tk.id}`)
    gaLapDanhSach(thanhVien('999'))
    expect(await sweepDiscordKicks()).toMatchObject({ checked: 0, locked: 0 })
    expect((await trangThai(tk.id)).reason).toBe('admin')
  })

  it('hai lượt chạy chồng nhau (blue/green) → lượt sau nhường, không quét đôi', async () => {
    await taiKhoanCong('60')
    let tra!: (r: Response) => void
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>((res) => (tra = res)))

    const first = sweepDiscordKicksExclusive()
    // Đợi lượt đầu giành xong lock và đang treo ở cú gọi Discord.
    await vi.waitFor(() => expect(tra).toBeDefined())
    const second = await sweepDiscordKicksExclusive()
    expect(second.skipped).toBe('dang_chay_noi_khac')

    tra(new Response(JSON.stringify(thanhVien('60')), { status: 200 }))
    expect((await first).skipped).toBeNull()
    // Lock đã nhả: lượt kế chạy bình thường.
    vi.restoreAllMocks()
    gaLapDanhSach(thanhVien('60'))
    expect((await sweepDiscordKicksExclusive()).skipped).toBeNull()
  })
})
