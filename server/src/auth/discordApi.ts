/**
 * Nói chuyện với Discord OAuth2 — tách khỏi route để test được mà không dựng HTTP.
 *
 * Chỉ xin hai scope: `identify` (lấy id + username) và `email`. KHÔNG xin `guilds`
 * hay `guilds.members.read`: hệ này không cấp tài khoản theo tư cách thành viên
 * server Discord, nên biết người ta ở trong những server nào là dữ liệu thừa —
 * và scope thừa là quyền thừa.
 */
import { config } from '../config'

const AUTHORIZE = 'https://discord.com/api/oauth2/authorize'
const TOKEN = 'https://discord.com/api/oauth2/token'
const ME = 'https://discord.com/api/users/@me'

/** Tính năng chỉ bật khi có ĐỦ ba giá trị — thiếu một là tắt, không chạy nửa vời. */
export function discordEnabled(): boolean {
  return Boolean(config.discordClientId && config.discordClientSecret && config.discordRedirectUri)
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.discordClientId,
    redirect_uri: config.discordRedirectUri,
    response_type: 'code',
    scope: 'identify email',
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
  username: string
  /** `null` khi người dùng không có email hoặc CHƯA xác minh — xem `verified`. */
  email: string | null
  verified: boolean
}

/**
 * Đổi `code` lấy access token rồi hỏi Discord xem đó là ai.
 *
 * Trả `null` cho MỌI kiểu hỏng (mạng, code hết hạn, Discord đổi định dạng) thay vì
 * ném: đây là đường người dùng đang đi giữa chừng, và một stack trace 500 ở đây thì
 * họ chỉ thấy trang trắng. Route gọi hàm này sẽ đưa họ về màn đăng nhập kèm lý do.
 */
export async function exchangeCodeForUser(code: string): Promise<DiscordUser | null> {
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
      id: me.id,
      username: typeof me.username === 'string' ? me.username : me.id,
      email: typeof me.email === 'string' && me.email !== '' ? me.email : null,
      verified: me.verified === true,
    }
  } catch {
    return null
  }
}
