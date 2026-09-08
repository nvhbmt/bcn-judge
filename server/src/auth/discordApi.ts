/**
 * Nói chuyện với Discord OAuth2 — tách khỏi route để test được mà không dựng HTTP.
 *
 * Scope xin theo cấu hình, không xin thừa:
 *   - luôn: `identify` (id + username) và `email`;
 *   - chỉ khi có `DISCORD_GUILD_ID`: thêm `guilds.members.read`.
 *
 * `guilds.members.read` chứ KHÔNG phải `guilds`, dù `guilds` dễ dùng hơn: `guilds`
 * trả về DANH SÁCH MỌI SERVER người đó tham gia — dữ liệu riêng tư không liên quan
 * gì tới việc họ có ở CLB hay không. `guilds.members.read` phải nêu đích danh một
 * guild, và chỉ trả về tư cách thành viên ở đúng guild đó.
 */
import { config } from '@/config'

const AUTHORIZE = 'https://discord.com/api/oauth2/authorize'
const TOKEN = 'https://discord.com/api/oauth2/token'
const ME = 'https://discord.com/api/users/@me'

/** Tính năng chỉ bật khi có ĐỦ ba giá trị — thiếu một là tắt, không chạy nửa vời. */
export function discordEnabled(): boolean {
  return Boolean(config.discordClientId && config.discordClientSecret && config.discordRedirectUri)
}

/** Có chặn theo server Discord hay không — bật bằng cách khai `DISCORD_GUILD_ID`. */
export function guildGateOn(): boolean {
  return discordEnabled() && config.discordGuildId !== ''
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.discordClientId,
    redirect_uri: config.discordRedirectUri,
    response_type: 'code',
    scope: guildGateOn() ? 'identify email guilds.members.read' : 'identify email',
    state,
    // Buộc Discord hỏi lại mỗi lần thay vì im lặng dùng lại uỷ quyền cũ. Máy dùng
    // chung ở CLB là chuyện thường, và `prompt=none` sẽ đăng nhập thẳng vào tài
    // khoản của người ngồi trước mà người sau không kịp thấy gì.
    prompt: 'consent',
  })
  return `${AUTHORIZE}?${params.toString()}`
}

export interface DiscordUser {
  id: string
  /** Handle định danh (post-2023 không còn discriminator) — ví dụ `minhanh`. */
  username: string
  /**
   * Tên người dùng tự đặt để HIỂN THỊ — thứ mọi nơi trong Discord gọi họ. `null`
   * khi tài khoản chưa đặt (Discord rơi về username). Đây mới là tên nên dùng làm
   * displayName; username chỉ là khoá định danh, thường viết thường và cụt.
   */
  globalName: string | null
  /** `null` khi người dùng không có email hoặc CHƯA xác minh — xem `verified`. */
  email: string | null
  verified: boolean
  /** Hash ảnh đại diện; `null` = đang dùng ảnh mặc định của Discord. */
  avatar: string | null
}

/**
 * Đổi `code` lấy access token rồi hỏi Discord xem đó là ai.
 *
 * Trả `null` cho MỌI kiểu hỏng (mạng, code hết hạn, Discord đổi định dạng) thay vì
 * ném: đây là đường người dùng đang đi giữa chừng, và một stack trace 500 ở đây thì
 * họ chỉ thấy trang trắng. Route gọi hàm này sẽ đưa họ về màn đăng nhập kèm lý do.
 */
export interface DiscordLogin {
  user: DiscordUser
  /** Giữ lại để hỏi tiếp tư cách thành viên guild; KHÔNG lưu xuống DB. */
  accessToken: string
}

export async function exchangeCodeForUser(code: string): Promise<DiscordLogin | null> {
  try {
    const tokenRes = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.discordClientId,
        client_secret: config.discordClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.discordRedirectUri,
      }),
    })
    if (!tokenRes.ok) return null

    const token = (await tokenRes.json()) as { access_token?: unknown }
    if (typeof token.access_token !== 'string' || token.access_token === '') return null

    const meRes = await fetch(ME, { headers: { authorization: `Bearer ${token.access_token}` } })
    if (!meRes.ok) return null

    const me = (await meRes.json()) as Record<string, unknown>
    if (typeof me.id !== 'string' || me.id === '') return null

    return {
      accessToken: token.access_token,
      user: {
        id: me.id,
        username: typeof me.username === 'string' ? me.username : me.id,
        globalName: typeof me.global_name === 'string' && me.global_name !== '' ? me.global_name : null,
        email: typeof me.email === 'string' && me.email !== '' ? me.email : null,
        verified: me.verified === true,
        avatar: typeof me.avatar === 'string' && me.avatar !== '' ? me.avatar : null,
      },
    }
  } catch {
    return null
  }
}

/**
 * Người này có ở trong guild đã cấu hình không, và mang những role nào.
 *
 * Discord trả 404 khi KHÔNG phải thành viên — đó là câu trả lời, không phải lỗi.
 * Phân biệt rõ ba trạng thái, vì gộp lại thì một sự cố mạng sẽ bị đọc thành "người
 * này không ở trong server" và khoá oan người đang ở trong đó:
 *   - `{ roles }` — là thành viên;
 *   - `null`      — chắc chắn KHÔNG phải thành viên (404);
 *   - `'loi'`     — không biết (mạng hỏng, token sai, Discord lỗi).
 */
export async function fetchGuildMember(
  accessToken: string,
  guildId: string,
): Promise<{ roles: string[] } | null | 'loi'> {
  try {
    const res = await fetch(`${ME}/guilds/${encodeURIComponent(guildId)}/member`, {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    if (res.status === 404) return null
    if (!res.ok) return 'loi'
    const body = (await res.json()) as { roles?: unknown }
    return { roles: Array.isArray(body.roles) ? body.roles.filter((r): r is string => typeof r === 'string') : [] }
  } catch {
    return 'loi'
  }
}

export interface GuildMemberLite {
  id: string
  roles: string[]
}

/**
 * Danh sách thành viên guild bằng BOT token — cho bộ quét nền (discordSweep.ts).
 *
 * Khác `fetchGuildMember` (token OAuth của chính người dùng, chỉ hỏi được về họ), bot
 * hỏi được cả server nhưng cần bật **Server Members Intent** trong Developer Portal;
 * thiếu thì Discord trả 403. Phân trang bằng `after` = id lớn nhất của trang trước
 * (Discord trả theo id tăng dần), tối đa 1000 người mỗi trang.
 *
 * Trả `'loi'` cho MỌI thất bại (mạng, 401/403/429, body lạ): người gọi bỏ lượt, không
 * khoá ai — một nửa danh sách nguy hiểm hơn không có danh sách.
 */
export async function fetchGuildMembers(botToken: string, guildId: string): Promise<GuildMemberLite[] | 'loi'> {
  const out: GuildMemberLite[] = []
  let after = '0'
  // 20 trang × 1000 = 20 000 người — gấp trăm lần một ban; vòng lặp có trần để không
  // quay vô hạn nếu Discord trả cùng một trang mãi.
  for (let page = 0; page < 20; page++) {
    let body: unknown
    try {
      const res = await fetch(
        `https://discord.com/api/guilds/${encodeURIComponent(guildId)}/members?limit=1000&after=${encodeURIComponent(after)}`,
        { headers: { authorization: `Bot ${botToken}` } },
      )
      if (!res.ok) return 'loi'
      body = await res.json()
    } catch {
      return 'loi'
    }
    if (!Array.isArray(body)) return 'loi'
    const batch: GuildMemberLite[] = []
    for (const item of body) {
      const user = (item as { user?: { id?: unknown } }).user
      const roles = (item as { roles?: unknown }).roles
      if (!user || typeof user.id !== 'string') continue
      batch.push({ id: user.id, roles: Array.isArray(roles) ? roles.filter((r): r is string => typeof r === 'string') : [] })
    }
    out.push(...batch)
    if (body.length < 1000 || batch.length === 0) break
    after = batch[batch.length - 1]!.id
  }
  return out
}

/**
 * URL ảnh đại diện trên CDN của Discord.
 *
 * Luôn `.png` kể cả với ảnh động (hash bắt đầu bằng `a_`): Discord vẫn phục vụ bản
 * tĩnh cho đuôi .png, và một cái GIF nhấp nháy ở góc thanh trên là thứ không ai xin.
 *
 * `size=64` vì chỗ hiện lớn nhất là 28px — lấy 64 để màn hình 2x vẫn nét, không hơn.
 */
export function avatarUrl(discordId: string | null, hash: string | null): string | null {
  if (!discordId || !hash) return null
  return `https://cdn.discordapp.com/avatars/${discordId}/${hash}.png?size=64`
}
