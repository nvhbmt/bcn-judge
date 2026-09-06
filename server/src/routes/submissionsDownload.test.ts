/**
 * Tải bài làm .zip (/api/mentor/problems/:id/submissions/download).
 *
 * Chốt: best = mỗi người một file, AC mới nhất (chưa AC thì lượt cuối); all = mọi lượt,
 * trùng tên thêm hậu tố; tên file chuẩn hoá không dấu; chỉ staff có quyền.
 */
import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { q } from '@/db/pool'
import {
  INTEGRATION,
  addTestcases,
  app,
  enroll,
  makeCourse,
  makeItem,
  makeProblem,
  makeUser,
  resetDb,
  setupDb,
  type TestUser,
} from '@/testing/harness'

async function rename(userId: string, name: string): Promise<void> {
  await q(sql`UPDATE users SET display_name = ${name} WHERE id = ${userId}`)
}
async function submit(userId: string, itemId: string, pid: string, o: { verdict: string; source: string; ago?: string }): Promise<void> {
  await q(sql`
    INSERT INTO submissions (id, kind, user_id, problem_id, item_id, language_id, source, source_bytes,
                             status, verdict, passed_weight, total_weight, received_at, attempt)
    VALUES (gen_random_uuid()::text, 'submit', ${userId}, ${pid}, ${itemId}, 'c11', ${o.source}, ${o.source.length},
            'done', ${o.verdict}, 1, 1, ${o.ago ? sql`now() - ${o.ago}::interval` : sql`now()`}, 1)
  `)
}
/** Gọi endpoint, trả về {status, contentType, buf}. */
async function download(pid: string, mode: string, as: TestUser) {
  const res = await app.request(`/api/mentor/problems/${pid}/submissions/download?mode=${mode}`, {
    headers: { cookie: as.cookie, 'x-api-response-version': '2' },
  })
  return { status: res.status, contentType: res.headers.get('content-type') ?? '', buf: Buffer.from(await res.arrayBuffer()) }
}
const has = (buf: Buffer, s: string) => buf.includes(Buffer.from(s))

describe.skipIf(!INTEGRATION)('tải bài làm .zip', () => {
  let admin: TestUser
  let member: TestUser
  let u1: TestUser
  let u2: TestUser
  let pid: string
  let itemId: string

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    admin = await makeUser('admin')
    member = await makeUser('member')
    u1 = await makeUser('member')
    u2 = await makeUser('member')
    await rename(u1.id, 'Việt Hoàng')
    await rename(u2.id, 'Nguyễn Đức')
    const course = await makeCourse(admin.id, { status: 'open' })
    await enroll(course.id, u1.id)
    await enroll(course.id, u2.id)
    pid = await makeProblem(admin.id, { scopeCourseId: course.id })
    await addTestcases(pid, [{ input: '1', expected: '1' }])
    itemId = await makeItem(course.id, pid)
  })

  it('best: mỗi người 1 file, lấy AC (bỏ WA), tên không dấu', async () => {
    await submit(u1.id, itemId, pid, { verdict: 'WA', source: 'u1_wa_src', ago: '2 hours' })
    await submit(u1.id, itemId, pid, { verdict: 'AC', source: 'u1_ac_src' })
    await submit(u2.id, itemId, pid, { verdict: 'WA', source: 'u2_only_src' })

    const { status, contentType, buf } = await download(pid, 'best', admin)
    expect(status).toBe(200)
    expect(contentType).toContain('zip')
    expect(has(buf, 'viet_hoang_bai_nop.c')).toBe(true)
    expect(has(buf, 'nguyen_duc_bai_nop.c')).toBe(true)
    expect(has(buf, 'u1_ac_src')).toBe(true) // lấy AC của Việt Hoàng
    expect(has(buf, 'u1_wa_src')).toBe(false) // KHÔNG lấy WA khi đã có AC
    expect(has(buf, 'u2_only_src')).toBe(true) // Nguyễn Đức chưa AC → lượt cuối
  })

  it('all: mọi lượt nộp, trùng tên thêm _2', async () => {
    await submit(u1.id, itemId, pid, { verdict: 'WA', source: 'u1_wa_src', ago: '2 hours' })
    await submit(u1.id, itemId, pid, { verdict: 'AC', source: 'u1_ac_src' })

    const { buf } = await download(pid, 'all', admin)
    expect(has(buf, 'viet_hoang_bai_nop.c')).toBe(true)
    expect(has(buf, 'viet_hoang_bai_nop_2.c')).toBe(true)
    expect(has(buf, 'u1_wa_src')).toBe(true)
    expect(has(buf, 'u1_ac_src')).toBe(true)
  })

  it('không có bài nộp → 404', async () => {
    const { status } = await download(pid, 'best', admin)
    expect(status).toBe(404)
  })

  it('member thường không tải được → 403', async () => {
    await submit(u1.id, itemId, pid, { verdict: 'AC', source: 'x' })
    const { status } = await download(pid, 'best', member)
    expect(status).toBe(403)
  })
})
