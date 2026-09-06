/**
 * BXH toàn cục /api/member/leaderboard — cá nhân/team × tuần/tháng/toàn thời gian.
 *
 * Bất biến chốt ở đây:
 *   - xếp theo SỐ BÀI AC trước rồi tổng điểm (§2.7), đánh dấu đúng "mình"/"team mình";
 *   - cửa sổ theo lịch LOẠI bài nộp ngoài kỳ (bài 40 ngày trước rớt khỏi tuần/tháng);
 *   - chỉ tính bài NỘP đã CHẤM XONG trên mục ĐÃ XUẤT BẢN — run, CE/IE, mục nháp không tính.
 */
import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { q } from '@/db/pool'
import {
  INTEGRATION,
  addTestcases,
  call,
  enroll,
  makeCourse,
  makeItem,
  makeProblem,
  makeUser,
  resetDb,
  setupDb,
  type TestUser,
} from '@/testing/harness'

interface SubOpts {
  verdict: string
  passed: number
  total: number
  ago?: string
  kind?: string
  status?: string
}
async function submit(userId: string, itemId: string, problemId: string, o: SubOpts): Promise<void> {
  await q(sql`
    INSERT INTO submissions (id, kind, user_id, problem_id, item_id, language_id, source, source_bytes,
                             status, verdict, passed_weight, total_weight, received_at, attempt)
    VALUES (gen_random_uuid()::text, ${o.kind ?? 'submit'}, ${userId}, ${problemId}, ${itemId}, 'c11', 'x', 1,
            ${o.status ?? 'done'}, ${o.verdict}, ${o.passed}, ${o.total},
            ${o.ago ? sql`now() - ${o.ago}::interval` : sql`now()`}, 1)
  `)
}

describe.skipIf(!INTEGRATION)('BXH toàn cục (/api/member/leaderboard)', () => {
  let admin: TestUser
  let u1: TestUser
  let u2: TestUser
  let u3: TestUser
  let courseId: string
  let item1: string
  let item2: string
  let p1: string
  let p2: string

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    admin = await makeUser('admin')
    u1 = await makeUser('member')
    u2 = await makeUser('member')
    u3 = await makeUser('member')
    const course = await makeCourse(admin.id, { status: 'open' })
    courseId = course.id
    for (const u of [u1, u2, u3]) await enroll(courseId, u.id)
    p1 = await makeProblem(admin.id, { scopeCourseId: courseId })
    p2 = await makeProblem(admin.id, { scopeCourseId: courseId })
    await addTestcases(p1, [{ input: '1', expected: '1' }])
    await addTestcases(p2, [{ input: '1', expected: '1' }])
    item1 = await makeItem(courseId, p1)
    item2 = await makeItem(courseId, p2)
  })

  it('cá nhân toàn thời gian: xếp theo AC rồi điểm, đánh dấu mình', async () => {
    await submit(u1.id, item1, p1, { verdict: 'AC', passed: 2, total: 2 })
    await submit(u1.id, item2, p2, { verdict: 'AC', passed: 2, total: 2 })
    await submit(u2.id, item1, p1, { verdict: 'AC', passed: 2, total: 2 })
    await submit(u3.id, item1, p1, { verdict: 'WA', passed: 1, total: 2 }) // 0 AC nhưng 50đ

    const res = await call('/api/member/leaderboard?scope=individual&window=all', { as: u1 })
    expect(res.status).toBe(200)
    const rows = res.body.data
    expect(rows.map((r: any) => r.userId)).toEqual([u1.id, u2.id, u3.id])
    expect(rows[0]).toMatchObject({ rank: 1, acCount: 2, totalPoints: 200, isMe: true })
    expect(rows[1]).toMatchObject({ rank: 2, acCount: 1, totalPoints: 100, isMe: false })
    expect(rows[2]).toMatchObject({ rank: 3, acCount: 0, totalPoints: 50, isMe: false })
  })

  it('cửa sổ tuần/tháng loại bài nộp ngoài kỳ; run/CE/nháp không tính', async () => {
    await submit(u1.id, item1, p1, { verdict: 'AC', passed: 2, total: 2, ago: '40 days' }) // ngoài tháng
    await submit(u2.id, item1, p1, { verdict: 'AC', passed: 2, total: 2 }) // trong tuần
    // Những thứ KHÔNG được tính vào bất kỳ kỳ nào:
    await submit(u3.id, item1, p1, { verdict: 'AC', passed: 2, total: 2, kind: 'run' })
    await submit(u3.id, item2, p2, { verdict: 'CE', passed: 0, total: 2 })

    const all = await call('/api/member/leaderboard?scope=individual&window=all', { as: admin })
    expect(all.body.data.map((r: any) => r.userId).sort()).toEqual([u1.id, u2.id].sort())

    const week = await call('/api/member/leaderboard?scope=individual&window=week', { as: admin })
    expect(week.body.data.map((r: any) => r.userId)).toEqual([u2.id]) // u1 (40 ngày) rớt

    const month = await call('/api/member/leaderboard?scope=individual&window=month', { as: admin })
    expect(month.body.data.map((r: any) => r.userId)).toEqual([u2.id])
  })

  it('mục nháp không tính vào điểm', async () => {
    const draftItem = await makeItem(courseId, p2, { status: 'draft' })
    await submit(u1.id, draftItem, p2, { verdict: 'AC', passed: 2, total: 2 })
    const res = await call('/api/member/leaderboard?scope=individual&window=all', { as: admin })
    expect(res.body.data).toHaveLength(0)
  })

  it('team: cộng theo team, xếp đúng, đánh dấu team mình + số người', async () => {
    const alpha = (await call('/api/admin/teams', { as: admin, body: { name: 'Alpha', leaderId: u1.id } })).body.data.id
    await call(`/api/admin/teams/${alpha}/members`, { as: admin, body: { userId: u2.id } })
    const beta = (await call('/api/admin/teams', { as: admin, body: { name: 'Beta', leaderId: u3.id } })).body.data.id

    await submit(u1.id, item1, p1, { verdict: 'AC', passed: 2, total: 2 })
    await submit(u2.id, item2, p2, { verdict: 'AC', passed: 2, total: 2 }) // Alpha: 2 AC
    await submit(u3.id, item1, p1, { verdict: 'AC', passed: 2, total: 2 }) // Beta: 1 AC

    const res = await call('/api/member/leaderboard?scope=team&window=all', { as: u1 })
    expect(res.status).toBe(200)
    const rows = res.body.data
    const a = rows.find((r: any) => r.id === alpha)
    const b = rows.find((r: any) => r.id === beta)
    expect(a).toMatchObject({ rank: 1, acCount: 2, isMine: true })
    expect(b).toMatchObject({ rank: 2, acCount: 1, isMine: false })

    // memberCount khớp số dòng team_members thật.
    const [cnt] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM team_members WHERE team_id = ${alpha}`)
    expect(a.memberCount).toBe(cnt!.n)
  })
})
