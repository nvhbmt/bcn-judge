/**
 * Quét nền: ai rời server Discord thì khoá tài khoản.
 *
 * Cổng guild (discordRoutes.ts) chỉ kiểm ĐƯỢC lúc đăng nhập, bằng token OAuth của chính
 * người dùng — token đó không được lưu lại, nên sau khi họ có phiên thì hệ thống mù
 * suốt 30 ngày (SESSION_TTL_DAYS). Bộ quét này lấp khoảng mù đó bằng BOT token: hỏi
 * Discord "server hiện có những ai" rồi so với các tài khoản đang mở.
 *
 * Ai bị khoá: đúng tập mà cổng đang cai quản — tài khoản gắn Discord và KHÔNG có mật
 * khẩu (do cổng sinh ra). Tài khoản admin cấp tay chỉ bị đụng khi admin bật
 * `discord_kick_locks_password_accounts` ở trang Cài đặt.
 *
 * Bốn lan can, cùng triết lý với cổng ("lỗi mạng không được mở toang cũng không được
 * báo oan"):
 *   1. Hỏi Discord không được (mạng, 401, 403 thiếu intent, 429) → BỎ LƯỢT, không khoá ai.
 *   2. Danh sách trả về rỗng → coi là lỗi, bỏ lượt.
 *   3. Một lượt định khoá QUÁ NỬA số tài khoản thuộc diện (và hơn 2 người) → huỷ lượt và
 *      log to — danh sách thiếu trang trông y hệt "cả server bỏ đi".
 *   4. Không bao giờ XOÁ — chỉ `disabled`; bài nộp, tiến độ giữ nguyên (FR-A4).
 *
 * Chạy trong tiến trình API (index.ts), không phải worker: biến DISCORD_* nằm ở
 * `.env.api`, và chỉ role Postgres của API mới có quyền UPDATE users. API chạy hai bản
 * blue/green nên mỗi lượt giành advisory lock trước — bản nào không giành được thì thôi.
 */
import { sql } from 'drizzle-orm'
import { config } from '@/config'
import { pool, q } from '@/db/pool'
import { audit } from '@/lib/audit'
import { getSettings, setSetting } from '@/lib/settings'
import { fetchGuildMembers, guildGateOn, type GuildMemberLite } from './discordApi'
import { revokeAllSessionsOf } from './session'

export interface SweepAccount {
  id: string
  discordId: string
  hasPassword: boolean
}

export interface SweepResult {
  at: string
  /** Số tài khoản thuộc diện đã đối chiếu. */
  checked: number
  locked: number
  /** null = lượt chạy trọn; còn lại là lý do bỏ lượt (mã, không phải câu chữ). */
  skipped: 'discord_loi' | 'danh_sach_rong' | 'qua_nua' | 'dang_chay_noi_khac' | null
}

/** Khoá settings ghi kết quả lượt gần nhất — trang Tình trạng chấm đọc ra. */
export const SWEEP_LAST_KEY = 'discord_sweep_last'

/** Khoá advisory cố định cho bộ quét — bất kỳ số nào, miễn là một và chỉ một. */
const SWEEP_LOCK_ID = 7_310_002

export function sweepEnabled(): boolean {
  return guildGateOn() && config.discordBotToken !== '' && config.discordKickSweepMinutes > 0
}

/**
 * Hàm thuần: trong `accounts`, ai không còn (đúng tư cách) trong `members`.
 *
 * Tách riêng để test không cần Discord lẫn DB — và để luật "ai bị khoá" đọc được trong
 * mười dòng thay vì lẫn giữa fetch và UPDATE.
 */
export function diffKicked(
  accounts: SweepAccount[],
  members: GuildMemberLite[],
  opts: { roleId: string; lockPasswordAccounts: boolean },
): { account: SweepAccount; reason: 'roi_server' | 'thieu_vai_tro' }[] {
  const byId = new Map(members.map((m) => [m.id, m]))
  const out: { account: SweepAccount; reason: 'roi_server' | 'thieu_vai_tro' }[] = []
  for (const account of accounts) {
    if (account.hasPassword && !opts.lockPasswordAccounts) continue
    const m = byId.get(account.discordId)
    if (!m) out.push({ account, reason: 'roi_server' })
    else if (opts.roleId && !m.roles.includes(opts.roleId)) out.push({ account, reason: 'thieu_vai_tro' })
  }
  return out
}

/** Lan can 3: quá nửa (và hơn hai người) thì không tin danh sách. */
export function tooManyToLock(kicked: number, eligible: number): boolean {
  return kicked > Math.max(2, Math.floor(eligible / 2))
}

/** Một lượt quét. Mọi kết quả — kể cả bỏ lượt — đều ghi lại để admin thấy. */
export async function sweepDiscordKicks(now = new Date()): Promise<SweepResult> {
  const result = await runSweep(now)
  await setSetting(SWEEP_LAST_KEY, result, null)
  return result
}

async function runSweep(now: Date): Promise<SweepResult> {
  const at = now.toISOString()
  const members = await fetchGuildMembers(config.discordBotToken, config.discordGuildId)
  if (members === 'loi') return { at, checked: 0, locked: 0, skipped: 'discord_loi' }
  if (members.length === 0) return { at, checked: 0, locked: 0, skipped: 'danh_sach_rong' }

  const settings = await getSettings()
  const lockPasswordAccounts = settings.discord_kick_locks_password_accounts

  // `password_hash IS NOT NULL` chứ không lấy hash ra: bộ quét không có việc gì với nó.
  const rows = await q<{ id: string; discordId: string; hasPassword: boolean }>(sql`
    SELECT id, discord_id AS "discordId", (password_hash IS NOT NULL) AS "hasPassword"
    FROM users
    WHERE discord_id IS NOT NULL AND disabled = false AND deleted_at IS NULL
  `)
  const eligible = rows.filter((r) => !r.hasPassword || lockPasswordAccounts)
  const kicked = diffKicked(rows, members, { roleId: config.discordRoleId, lockPasswordAccounts })

  if (tooManyToLock(kicked.length, eligible.length)) {
    console.error(
      `[discord-sweep] định khoá ${kicked.length}/${eligible.length} tài khoản trong một lượt — huỷ, nghi danh sách Discord thiếu`,
    )
    return { at, checked: eligible.length, locked: 0, skipped: 'qua_nua' }
  }

  let locked = 0
  for (const { account, reason } of kicked) {
    // `AND disabled = false` để hai lượt chồng nhau không ghi đè lý do của admin vừa khoá.
    const [row] = await q<{ id: string }>(sql`
      UPDATE users SET disabled = true, disabled_reason = 'discord_kick', disabled_at = now()
      WHERE id = ${account.id} AND disabled = false
      RETURNING id
    `)
    if (!row) continue
    await revokeAllSessionsOf(account.id)
    await audit(null, 'user.auto_lock', 'user', account.id, null, {
      discordId: account.discordId,
      guildId: config.discordGuildId,
      reason,
    })
    locked++
  }
  return { at, checked: eligible.length, locked, skipped: null }
}

/**
 * Giành advisory lock rồi quét; không giành được nghĩa là bản API kia đang quét.
 *
 * Lock ở mức PHIÊN trên một connection riêng, giữ suốt lượt quét rồi nhả. Không dùng
 * lock giao dịch vì lượt quét gồm nhiều câu lệnh và một cú gọi mạng ra Discord — gói
 * cả vào một transaction là giữ một connection mở trong lúc chờ mạng, đúng thứ pool
 * không muốn.
 */
export async function sweepDiscordKicksExclusive(now = new Date()): Promise<SweepResult> {
  const client = await pool.connect()
  try {
    const { rows } = await client.query<{ got: boolean }>('SELECT pg_try_advisory_lock($1) AS got', [SWEEP_LOCK_ID])
    if (!rows[0]?.got) return { at: now.toISOString(), checked: 0, locked: 0, skipped: 'dang_chay_noi_khac' }
    try {
      return await sweepDiscordKicks(now)
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [SWEEP_LOCK_ID])
    }
  } finally {
    client.release()
  }
}

/** Nối bộ quét vào một tiến trình dài hạn; trả hàm dừng. Tắt thì log một dòng và thôi. */
export function startDiscordSweep(log: (m: string) => void = console.log): () => void {
  if (!sweepEnabled()) {
    log('[discord-sweep] tắt (cần DISCORD_GUILD_ID + DISCORD_BOT_TOKEN, và DISCORD_KICK_SWEEP_MINUTES > 0)')
    return () => {}
  }
  const run = () =>
    sweepDiscordKicksExclusive()
      .then((r) => {
        if (r.skipped === 'dang_chay_noi_khac') return
        log(`[discord-sweep] ${r.checked} tài khoản, khoá ${r.locked}${r.skipped ? ` — bỏ lượt: ${r.skipped}` : ''}`)
      })
      .catch((err) => console.error('[discord-sweep] hỏng:', err))
  log(`[discord-sweep] mỗi ${config.discordKickSweepMinutes} phút`)
  // Lượt đầu chờ một phút thay vì chạy ngay: lúc khởi động, Postgres và mạng có thể chưa
  // sẵn, và một lượt hỏng ngay giây đầu là dòng log đầu tiên admin đọc — gây hoang mang vô ích.
  const first = setTimeout(run, 60_000)
  const timer = setInterval(run, config.discordKickSweepMinutes * 60_000)
  return () => {
    clearTimeout(first)
    clearInterval(timer)
  }
}
