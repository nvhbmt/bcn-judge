/**
 * Client API — luôn gửi `x-api-response-version: 2` và bóc envelope
 * `{success, data, meta}` (design.md §5, mẫu imath-test).
 */
const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly error: ApiError,
  ) {
    super(error.message)
    this.name = 'ApiFailure'
  }
}

export interface ApiResult<T> {
  data: T
  meta: Record<string, unknown>
}

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'x-api-response-version': '2',
      ...(init.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  let body: { success?: boolean; data?: T; error?: ApiError; meta?: Record<string, unknown> } | null = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok || body?.success === false) {
    throw new ApiFailure(res.status, body?.error ?? { code: 'network', message: 'Không kết nối được máy chủ.' })
  }
  return { data: (body?.data ?? null) as T, meta: body?.meta ?? {} }
}

export const api = {
  get: <T,>(path: string) => request<T>(path).then((r) => r.data),
  getWithMeta: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }).then(
      (r) => r.data,
    ),
  patch: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }).then((r) => r.data),
  put: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }).then((r) => r.data),
  del: <T,>(path: string) => request<T>(path, { method: 'DELETE' }).then((r) => r.data),
  upload: <T,>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }).then((r) => r.data),
}
