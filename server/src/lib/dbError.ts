/**
 * drizzle bọc lỗi Postgres trong `DrizzleQueryError`, nên `String(err)` KHÔNG chứa
 * tên constraint — chuỗi chỉ có "Failed query: …". Tên constraint nằm ở `cause`.
 *
 * Đây là lớp lỗi đã cắn một lần: mọi nhánh 409 (email trùng, mã khoá trùng, member
 * hai team, leader ngoài team) im lặng rơi xuống 500. Dùng helper này thay cho
 * `String(err).includes(...)`.
 */
export function describeDbError(err: unknown): string {
  const parts: string[] = []
  const seen = new Set<unknown>()
  let current: unknown = err

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const e = current as { message?: unknown; constraint?: unknown; detail?: unknown; cause?: unknown }
    if (typeof e.constraint === 'string') parts.push(e.constraint)
    if (typeof e.message === 'string') parts.push(e.message)
    if (typeof e.detail === 'string') parts.push(e.detail)
    current = e.cause
  }
  return parts.join(' | ')
}

export function isConstraintViolation(err: unknown, constraint: string): boolean {
  return describeDbError(err).includes(constraint)
}
