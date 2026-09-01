/**
 * Harness cho test tích hợp (mẫu imath: app.request in-process, không mở cổng).
 *
 * AN TOÀN: truncate MỌI bảng nên bắt buộc tên database phải chứa "test" — đúng
 * kỷ luật của imath-test/server.
 */
import type { Hono } from 'hono'
import { createApp } from '../app'
import { config } from '../config'
import { hashPassword } from '../auth/hash'
import { createSession } from '../auth/session'
import { db, pool } from '../db/pool'
import { migrate } from '../db/migrate'
import { seed } from '../db/seed'
import { courseEnrollments, courseMentors, courses, users } from '../db/schema'
import { resetRateLimits } from '../lib/http'

export const INTEGRATION = process.env.INTEGRATION === '1'

if (INTEGRATION && !/test/i.test(config.databaseUrl)) {
  throw new Error(`DATABASE_URL phải chứa "test" cho test tích hợp: ${config.databaseUrl}`)
}

export const app: Hono = createApp()

export async function setupDb(): Promise<void> {
  await migrate(() => {})
}

export async function resetDb(): Promise<void> {
  const { rows } = await pool.query<{ list: string | null }>(`
    SELECT string_agg(quote_ident(tablename), ', ') AS list
    FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_migrations'
  `)
  const list = rows[0]?.list
  if (list) await pool.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
  resetRateLimits()
  await seed(() => {})
}

export interface TestUser {
  id: string
  email: string
  role: 'admin' | 'mentor' | 'member'
  token: string
  cookie: string
}

let counter = 0

export async function makeUser(
  role: TestUser['role'],
  overrides: { email?: string; password?: string; disabled?: boolean } = {},
): Promise<TestUser> {
  counter++
  const email = overrides.email ?? `${role}${counter}@test.local`
  const { hash, algo } = await hashPassword(overrides.password ?? 'password123')
  const [row] = await db
    .insert(users)
    .values({
      email,
      displayName: `${role} ${counter}`,
      role,
      passwordHash: hash,
      hashAlgo: algo,
      mustChangePassword: false,
      disabled: overrides.disabled ?? false,
    })
    .returning({ id: users.id })

  const session = await createSession(row!.id, null, 'vitest')
  return {
    id: row!.id,
    email,
    role,
    token: session.token,
    cookie: `${config.sessionCookie}=${session.token}`,
  }
}

export async function makeCourse(
  createdBy: string,
  overrides: { code?: string; status?: 'draft' | 'open' | 'archived' } = {},
): Promise<{ id: string; code: string }> {
  counter++
  const code = overrides.code ?? `course${counter}`
  const [row] = await db
    .insert(courses)
    .values({ code, name: `Khoá ${counter}`, status: overrides.status ?? 'open', createdBy })
    .returning({ id: courses.id, code: courses.code })
  return row!
}

export async function assignMentor(courseId: string, userId: string): Promise<void> {
  await db.insert(courseMentors).values({ courseId, userId }).onConflictDoNothing()
}

export async function enroll(courseId: string, userId: string): Promise<void> {
  await db.insert(courseEnrollments).values({ courseId, userId }).onConflictDoNothing()
}

export interface CallOptions {
  as?: TestUser | null
  body?: unknown
  method?: string
  headers?: Record<string, string>
}

/** Gọi API in-process, luôn dùng envelope v2. */
export async function call(path: string, opts: CallOptions = {}): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    'x-api-response-version': '2',
    ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
    ...(opts.as ? { cookie: opts.as.cookie } : {}),
    ...opts.headers,
  }
  const res = await app.request(path, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { status: res.status, body }
}

export async function closeDb(): Promise<void> {
  await pool.end()
}
