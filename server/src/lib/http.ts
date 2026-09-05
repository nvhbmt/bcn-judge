/** Tiện ích HTTP nhỏ (mẫu imath: parseBody, clientIp, cookies, rateLimit). */
import type { Context } from 'hono'
import { z } from 'zod'
import { config } from '@/config'
import { errors } from './apiResponse'

export async function parseBody<S extends z.ZodTypeAny>(
  c: Context,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: Response }> {
  let raw: unknown
  try {
    const text = await c.req.text()
    // POST không body là hợp lệ khi mọi trường đều optional (vd /publish, /clone):
    // bắt lỗi ở đây thì client buộc phải nhớ gửi `{}`, một cái bẫy không cần thiết.
    raw = text.trim() === '' ? {} : JSON.parse(text)
  } catch {
    return { ok: false, response: errors.badRequest(c, 'Body phải là JSON hợp lệ.') }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
    return { ok: false, response: errors.badRequest(c, 'Dữ liệu không hợp lệ.', details) }
  }
  return { ok: true, data: parsed.data }
}

export function clientIp(c: Context): string | null {
  const fwd = c.req.header('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]?.trim() ?? null
  return c.req.header('x-real-ip') ?? null
}

export function setSessionCookie(c: Context, token: string, maxAgeSec: number): void {
  const parts = [
    `${config.sessionCookie}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ]
  if (config.secureCookie) parts.push('Secure')
  c.header('Set-Cookie', parts.join('; '), { append: true })
}

export function clearSessionCookie(c: Context): void {
  c.header('Set-Cookie', `${config.sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`, {
    append: true,
  })
}

export function readSessionCookie(c: Context): string | null {
  const header = c.req.header('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === config.sessionCookie) return rest.join('=') || null
  }
  return null
}

/** Xô rate in-memory — chỉ dùng cho endpoint "mỹ phẩm" (login, draft).
 *  Giới hạn nộp bài quyết định đúng-sai được DB thi hành (§4.2). */
const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs = 60_000): { ok: boolean; retryAfterSec: number } {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSec: 0 }
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  bucket.count++
  return { ok: true, retryAfterSec: 0 }
}

export function resetRateLimits(): void {
  buckets.clear()
}
