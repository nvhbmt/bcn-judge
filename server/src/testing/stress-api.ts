/**
 * Đo năng lực ĐỌC của API: 100 người cùng mở app trong giờ contest.
 *
 *   cd server && DATABASE_URL=... BASE=http://localhost:8299 \
 *     node --import tsx src/testing/stress-api.ts --users 100 --seconds 30
 *
 * Phiên đăng nhập được tạo THẲNG trong DB. Không phải để lách bảo mật mà vì
 * `/auth/login` chặn 10 lần/phút mỗi IP (chống dò mật khẩu, đúng đắn) — đăng nhập
 * 100 lần từ một máy sẽ đo ra chính cái giới hạn đó chứ không phải năng lực máy chủ.
 *
 * Trang nặng nhất là bảng xếp hạng contest: nó là TRUY VẤN DẪN XUẤT (§7), không có
 * bảng điểm sẵn, nên mỗi lần mở là một lần quét bài nộp. Đó là chỗ đáng lo nhất khi
 * cả lớp F5 trong 5 phút cuối contest.
 */
import { randomBytes, createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { pool, q } from '../db/pool'

const arg = (n: string, d: string): string => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? (process.argv[i + 1] ?? d) : d
}
const BASE = process.env.BASE ?? 'http://localhost:8299'
const USERS = Number(arg('users', '100'))
const SECONDS = Number(arg('seconds', '30'))
/** Thời gian "suy nghĩ" giữa hai lần bấm. 0 = bắn hết sức, để tìm trần của máy chủ. */
const THINK = Number(arg('think', '1000'))
const COOKIE = process.env.SESSION_COOKIE ?? 'bcn_session'

async function makeSessions(): Promise<string[]> {
  const members = await q<{ id: string }>(sql`
    SELECT id FROM users WHERE role = 'member' AND disabled = false LIMIT ${USERS}
  `)
  if (members.length === 0) throw new Error('chưa có member nào — chạy seed demo trước')
  const tokens: string[] = []
  for (let i = 0; i < USERS; i++) {
    const user = members[i % members.length]!
    const token = randomBytes(32).toString('base64url')
    await q(sql`
      INSERT INTO user_sessions (token_hash, user_id, expires_at)
      VALUES (${createHash('sha256').update(token).digest()}, ${user.id}, now() + interval '1 hour')
    `)
    tokens.push(token)
  }
  return tokens
}

interface Sample {
  path: string
  ms: number
  status: number
}

async function main(): Promise<void> {
  const tokens = await makeSessions()

  const [course] = await q<{ id: string }>(sql`SELECT id FROM courses ORDER BY created_at LIMIT 1`)
  const [contest] = await q<{ id: string }>(sql`
    SELECT id FROM contests WHERE status = 'published' AND now() BETWEEN start_at AND end_at LIMIT 1
  `)
  if (!course) throw new Error('chưa có khoá học nào')

  const paths = [
    ['giáo trình', `/api/member/courses/${course.id}/syllabus`],
    ['BXH khoá', `/api/member/courses/${course.id}/leaderboard`],
    ['khoá của tôi', '/api/member/courses'],
    ...(contest ? ([['BXH contest', `/api/member/contests/${contest.id}/standings`]] as [string, string][]) : []),
  ] as [string, string][]

  console.log(`${USERS} người · ${SECONDS} s · nghỉ ${THINK} ms · ${paths.length} trang: ${paths.map((p) => p[0]).join(', ')}\n`)

  const samples: Sample[] = []
  const deadline = Date.now() + SECONDS * 1000
  let errors = 0

  // Mỗi "người" là một vòng lặp riêng, mở trang rồi nghỉ 1 s — giống người thật
  // bấm quanh app, không phải máy bắn liên tục.
  const person = async (token: string, seed: number): Promise<void> => {
    let i = seed
    while (Date.now() < deadline) {
      const [label, path] = paths[i++ % paths.length]!
      const t0 = Date.now()
      try {
        const res = await fetch(BASE + path, {
          headers: { cookie: `${COOKIE}=${token}`, 'x-api-response-version': '2' },
        })
        await res.arrayBuffer()
        samples.push({ path: label, ms: Date.now() - t0, status: res.status })
        if (res.status >= 400) errors++
      } catch {
        errors++
      }
      if (THINK > 0) await new Promise((r) => setTimeout(r, THINK))
    }
  }

  await Promise.all(tokens.map((t, i) => person(t, i)))

  const pct = (list: number[], p: number): number =>
    list.length === 0 ? 0 : [...list].sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * p))]!

  console.log(`Tổng ${samples.length} request trong ${SECONDS} s = ${(samples.length / SECONDS).toFixed(0)} req/s · lỗi ${errors}\n`)
  console.log('Trang'.padEnd(16) + 'n'.padStart(7) + 'p50'.padStart(9) + 'p95'.padStart(9) + 'p99'.padStart(9) + 'max'.padStart(9))
  for (const [label] of paths) {
    const ms = samples.filter((s) => s.path === label).map((s) => s.ms)
    if (ms.length === 0) continue
    console.log(
      label.padEnd(16) +
        String(ms.length).padStart(7) +
        `${pct(ms, 0.5)} ms`.padStart(9) +
        `${pct(ms, 0.95)} ms`.padStart(9) +
        `${pct(ms, 0.99)} ms`.padStart(9) +
        `${Math.max(...ms)} ms`.padStart(9),
    )
  }

  await q(sql`DELETE FROM user_sessions WHERE expires_at < now() + interval '2 hours'`)
}

await main()
await pool.end()
