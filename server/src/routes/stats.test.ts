/**
 * Thống kê của một bài (GET /api/member/stats/problem) — FR-E3 v0.8.
 *
 * Bất biến: chỉ đếm bài NỘP đã chấm xong (run/pending/IE không tính); "người" đếm một
 * lần dù nộp nhiều; thời gian lấy bài AC TỐT NHẤT mỗi người; ngữ cảnh contest chỉ nhìn
 * contest đó trong cửa sổ; không có tên ai trong phản hồi; cổng truy cập y như đề bài.
 */
import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { q } from '@/db/pool'
import { percentile, timeBuckets } from '@/routes/member/stats'
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

describe('timeBuckets / percentile', () => {
  it('8 ô: 1/64 … 1/1 giới hạn rồi vô cực; giới hạn nhỏ không sinh mốc 0', () => {
    expect(timeBuckets(1000)).toEqual([16, 32, 63, 125, 250, 500, 1000, Number.POSITIVE_INFINITY])
    expect(timeBuckets(10)[0]).toBe(1)
  })
  it('phân vị hạng gần nhất; rỗng → null', () => {
    expect(percentile([], 0.5)).toBeNull()
    expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30)
    expect(percentile([10, 20, 30, 40, 50], 0.9)).toBe(50)
    expect(percentile([40, 80, 120], 0.9)).toBe(120)
    expect(percentile([7], 0.9)).toBe(7)
  })
})

interface Sub {
  verdict: string
  passed?: number
  total?: number
  timeMs?: number | null
  memoryKb?: number | null
  kind?: string
  status?: string
  languageId?: string
  contest?: { contestId: string; cpId: string }
  minutesAgo?: number
}

describe.skipIf(!INTEGRATION)('thống kê bài', () => {
  let admin: TestUser
  let u1: TestUser
  let u2: TestUser
  let u3: TestUser
  let ngoai: TestUser
  let courseId: string
  let p1: string
  let item1: string

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    admin = await makeUser('admin')
    u1 = await makeUser('member')
    u2 = await makeUser('member')
    u3 = await makeUser('member')
    ngoai = await makeUser('member')
    courseId = (await makeCourse(admin.id, { status: 'open' })).id
    for (const u of [u1, u2, u3]) await enroll(courseId, u.id)
    p1 = await makeProblem(admin.id, { scopeCourseId: courseId, timeLimitMs: 1000 })
    await addTestcases(p1, [{ input: '1', expected: '1' }])
    item1 = await makeItem(courseId, p1)
  })

  async function submit(u: TestUser, o: Sub): Promise<void> {
    await q(sql`
      INSERT INTO submissions (kind, user_id, problem_id, item_id, contest_id, contest_problem_id, language_id,
                               source, source_bytes, status, verdict, passed_weight, total_weight,
                               time_ms_max, memory_kb_max, attempt, received_at)
      VALUES (${o.kind ?? 'submit'}, ${u.id}, ${p1}, ${o.contest ? null : item1},
              ${o.contest?.contestId ?? null}, ${o.contest?.cpId ?? null}, ${o.languageId ?? 'c11'},
              'x', 1, ${o.status ?? 'done'}, ${o.verdict}, ${o.passed ?? (o.verdict === 'AC' ? 2 : 1)}, ${o.total ?? 2},
              ${o.timeMs ?? null}, ${o.memoryKb ?? null}, 1, now() - make_interval(mins => ${o.minutesAgo ?? 0}))
    `)
  }

  const stats = async (as: TestUser, qs = `itemId=${item1}`) => call(`/api/member/stats/problem?${qs}`, { as })

  it('đếm lượt nộp, người, người đã giải, phân bố verdict và ngôn ngữ', async () => {
    await submit(u1, { verdict: 'WA' })
    await submit(u1, { verdict: 'WA', languageId: 'python3' })
    await submit(u1, { verdict: 'AC', timeMs: 40 })
    await submit(u2, { verdict: 'AC', timeMs: 80 })
    await submit(u3, { verdict: 'TLE' })

    const res = await stats(u3)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      submissions: 5,
      users: 3,
      solvedUsers: 2,
      verdicts: { AC: 2, WA: 2, TLE: 1, MLE: 0, RE: 0, CE: 0 },
      languages: [
        { id: 'c11', count: 4 },
        { id: 'python3', count: 1 },
      ],
    })
    // Không có tên ai.
    expect(JSON.stringify(res.body.data)).not.toContain(u1.id)
    expect(JSON.stringify(res.body.data)).not.toContain('member')
  })

  it('run, pending và IE không tính; bài chưa ai nộp thì mọi số bằng 0 và mine null', async () => {
    await submit(u1, { verdict: 'AC', kind: 'run', timeMs: 5 })
    await submit(u1, { verdict: 'AC', status: 'pending' })
    await submit(u1, { verdict: 'IE' })
    const res = await stats(u1)
    expect(res.body.data).toMatchObject({ submissions: 0, users: 0, solvedUsers: 0, mine: null })
    expect(res.body.data.time.p50).toBeNull()
    expect(res.body.data.time.buckets.every((b: { count: number }) => b.count === 0)).toBe(true)
  })

  it('thời gian lấy bài AC TỐT NHẤT mỗi người; "mình" so với người khác', async () => {
    await submit(u1, { verdict: 'AC', timeMs: 100, memoryKb: 2000 })
    await submit(u1, { verdict: 'AC', timeMs: 40, memoryKb: 1200 }) // tốt nhất của u1
    await submit(u2, { verdict: 'AC', timeMs: 80 })
    await submit(u3, { verdict: 'AC', timeMs: 120 })
    await submit(u3, { verdict: 'WA', timeMs: 1 }) // WA nhanh không tính

    const r1 = (await stats(u1)).body.data
    expect(r1.time).toMatchObject({ limitMs: 1000, p50: 80, p90: 120 })
    expect(r1.mine).toEqual({ bestTimeMs: 40, bestMemoryKb: 1200, fasterThanPct: 100 })
    // Ô thời gian theo giới hạn 1000: 40 → (32, 63], 80 → (63, 125], 120 → (63, 125].
    expect(r1.time.buckets.map((b: { count: number }) => b.count)).toEqual([0, 0, 1, 2, 0, 0, 0, 0])
    expect(r1.time.buckets[6]).toEqual({ upToMs: 1000, count: 0 })
    expect(r1.time.buckets[7]).toEqual({ upToMs: null, count: 0 })

    const r3 = (await stats(u3)).body.data
    expect(r3.mine.fasterThanPct).toBe(0)
    // Người chưa AC: mine null dù đã nộp.
    await submit(ngoai, { verdict: 'WA' })
    await enroll(courseId, ngoai.id)
    expect((await stats(ngoai)).body.data.mine).toBeNull()
  })

  it('một mình AC thì không có ai để "nhanh hơn" — pct null, không phải 100', async () => {
    await submit(u1, { verdict: 'AC', timeMs: 40 })
    expect((await stats(u1)).body.data.mine.fasterThanPct).toBeNull()
  })

  it('ngữ cảnh contest: chỉ bài nộp của contest đó trong cửa sổ; bài luyện nhìn mọi ngữ cảnh', async () => {
    const [ct] = await q<{ id: string }>(sql`
      INSERT INTO contests (title, course_id, start_at, end_at, status)
      VALUES ('C', NULL, now() - interval '2 hours', now() + interval '2 hours', 'published') RETURNING id`)
    const [cp] = await q<{ id: string }>(sql`
      INSERT INTO contest_problems (contest_id, problem_id, position, label, max_score)
      VALUES (${ct!.id}, ${p1}, 1, 'A', 100) RETURNING id`)
    const contest = { contestId: ct!.id, cpId: cp!.id }

    await submit(u1, { verdict: 'AC', timeMs: 40 }) // luyện
    await submit(u2, { verdict: 'AC', timeMs: 80, contest, minutesAgo: 30 }) // contest, trong cửa sổ
    await submit(u3, { verdict: 'WA', contest, minutesAgo: 180 }) // trước giờ bắt đầu → luyện tập

    const inContest = (await stats(u1, `contestProblemId=${cp!.id}`)).body.data
    expect(inContest).toMatchObject({ submissions: 1, users: 1, solvedUsers: 1, mine: null })

    const practice = (await stats(u1)).body.data
    expect(practice).toMatchObject({ submissions: 3, users: 3, solvedUsers: 2 })
    expect(practice.mine.bestTimeMs).toBe(40)
  })

  it('cổng truy cập y như đề bài: chưa ghi danh → 404, thiếu handle → 404', async () => {
    expect((await stats(ngoai)).status).toBe(404)
    expect((await call('/api/member/stats/problem', { as: u1 })).status).toBe(404)
    expect((await call(`/api/member/stats/problem?itemId=${item1}`)).status).toBe(401)
  })
})
