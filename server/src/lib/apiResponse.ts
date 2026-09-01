/**
 * Envelope phản hồi (design.md §5, copy imath-test/server/src/lib/apiResponse.ts).
 *
 * Client gửi `x-api-response-version: 2` → `{success, data, meta}` /
 * `{success, error, meta}`. Không có header → payload legacy (data trần) để FE và
 * BE deploy độc lập được.
 */
import type { Context } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'

export interface ApiMeta {
  serverTime: string
  [key: string]: unknown
}

function wantsV2(c: Context): boolean {
  return c.req.header('x-api-response-version') === '2'
}

function meta(extra?: Record<string, unknown>): ApiMeta {
  return { serverTime: new Date().toISOString(), ...extra }
}

export function ok<T>(c: Context, data: T, extraMeta?: Record<string, unknown>) {
  if (!wantsV2(c)) return c.json(data as never)
  return c.json({ success: true, data, meta: meta(extraMeta) })
}

export function created<T>(c: Context, data: T, extraMeta?: Record<string, unknown>) {
  c.status(201)
  return ok(c, data, extraMeta)
}

export interface ApiErrorBody {
  code: string
  message: string
  details?: unknown
}

export function fail(
  c: Context,
  status: StatusCode,
  code: string,
  message: string,
  details?: unknown,
) {
  c.status(status)
  const error: ApiErrorBody = details === undefined ? { code, message } : { code, message, details }
  if (!wantsV2(c)) return c.json({ error: message, code } as never)
  return c.json({ success: false, error, meta: meta() })
}

export const errors = {
  unauthorized: (c: Context) => fail(c, 401, 'unauthorized', 'Cần đăng nhập.'),
  forbidden: (c: Context, message = 'Không có quyền thực hiện.') => fail(c, 403, 'forbidden', message),
  notFound: (c: Context, message = 'Không tìm thấy.') => fail(c, 404, 'not_found', message),
  badRequest: (c: Context, message: string, details?: unknown) =>
    fail(c, 400, 'bad_request', message, details),
  conflict: (c: Context, code: string, message: string, details?: unknown) =>
    fail(c, 409, code, message, details),
  tooMany: (c: Context, message: string, details?: unknown) =>
    fail(c, 429, 'rate_limited', message, details),
}
