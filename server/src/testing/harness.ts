/**
 * Harness cho test tích hợp (mẫu imath: app.request in-process, không mở cổng).
 *
 * AN TOÀN: truncate MỌI bảng nên bắt buộc tên database phải chứa "test" — đúng
 * kỷ luật của imath-test/server.
 */
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { Hono } from 'hono'
import { createApp } from '../app'
import { config } from '../config'
import { hashPassword } from '../auth/hash'
import { createSession } from '../auth/session'
import { db, pool, q } from '../db/pool'
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
  overrides: { email?: string; password?: string; disabled?: boolean; mustChangePassword?: boolean } = {},
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
      mustChangePassword: overrides.mustChangePassword ?? false,
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

export async function makeProblem(
  createdBy: string,
  overrides: {
    title?: string
    solutionSource?: string
    solutionLanguageId?: string
    timeLimitMs?: number
    scopeCourseId?: string
  } = {},
): Promise<string> {
  counter++
  const [row] = await q<{ id: string }>(sql`
    INSERT INTO problems (title, statement_md, time_limit_ms, solution_source, solution_language_id,
                          scope_course_id, created_by)
    VALUES (${overrides.title ?? `Bài ${counter}`}, ${'Đề bài mẫu'}, ${overrides.timeLimitMs ?? 2000},
            ${overrides.solutionSource ?? null}, ${overrides.solutionLanguageId ?? null},
            ${overrides.scopeCourseId ?? null}, ${createdBy})
    RETURNING id
  `)
  return row!.id
}

export async function addTestcases(
  problemId: string,
  list: { input: string; expected: string | null; kind?: 'sample' | 'hidden'; weight?: number }[],
): Promise<void> {
  for (const [i, tc] of list.entries()) {
    const input = Buffer.from(tc.input, 'utf8')
    const expected = tc.expected === null ? null : Buffer.from(tc.expected, 'utf8')
    await q(sql`
      INSERT INTO testcases (problem_id, position, kind, weight, input, expected,
                             input_bytes, expected_bytes, input_sha256)
      VALUES (${problemId}, ${i + 1}, ${tc.kind ?? 'hidden'}, ${tc.weight ?? 1}, ${input}, ${expected},
              ${input.length}, ${expected?.length ?? null}, ${createHash('sha256').update(input).digest()})
    `)
  }
}

/** Tạo chương + mục trỏ tới bài (P4 sẽ có API; test P2 dựng thẳng ở DB). */
export async function makeItem(
  courseId: string,
  problemId: string,
  overrides: { status?: 'draft' | 'published' } = {},
): Promise<string> {
  const [section] = await q<{ id: string }>(sql`
    INSERT INTO sections (course_id, title, position) VALUES (${courseId}, 'Chương 1', 1) RETURNING id
  `)
  const [item] = await q<{ id: string }>(sql`
    INSERT INTO items (section_id, kind, title, position, status, problem_id)
    VALUES (${section!.id}, 'problem', 'Bài tập', 1, ${overrides.status ?? 'published'}, ${problemId})
    RETURNING id
  `)
  return item!.id
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
