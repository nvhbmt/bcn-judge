/**
 * Lời giải chia sẻ (/api/member/solutions) — FR-K v0.8.
 *
 * Bốn luật được canh từng cái: chưa AC không thấy một byte source nào; chỉ bài AC tốt
 * nhất mỗi người và chỉ của người còn bật chia sẻ; cấm vận khi bài đang trong contest
 * mở (kể cả người AC qua khoá; staff thì không); lời giải mẫu theo đúng ba chế độ
 * FR-D7. Và serializer peer không mang kết quả test / log biên dịch của ai.
 */
import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { q } from '@/db/pool'
import {
  INTEGRATION,
  addTestcases,
  assignMentor,
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

const CANARY_SOLUTION = 'CANARY_REF_SOLUTION_91af'

interface Sub {
  verdict?: string
  timeMs?: number
  memoryKb?: number
  languageId?: string
  source?: string
  contest?: { contestId: string; cpId: string }
  minutesAgo?: number
}

describe.skipIf(!INTEGRATION)('lời giải chia sẻ', () => {
  let admin: TestUser
  let mentor: TestUser
  let solver: TestUser
  let stuck: TestUser
  let fast: TestUser
  let shy: TestUser
  let courseId: string
  let pid: string
  let itemId: string

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    admin = await makeUser('admin')
    mentor = await makeUser('mentor')
    solver = await makeUser('member')
    stuck = await makeUser('member')
    fast = await makeUser('member')
    shy = await makeUser('member')
    courseId = (await makeCourse(admin.id, { status: 'open' })).id
    // Mentor phải là mentor CỦA KHOÁ: đường lời giải đi qua cổng xem đề (resolveAccess),
    // khác thảo luận vốn chỉ hỏi "đã AC chưa".
    await assignMentor(courseId, mentor.id)
    for (const u of [solver, stuck, fast, shy]) await enroll(courseId, u.id)
    pid = await makeProblem(admin.id, { scopeCourseId: courseId, solutionSource: `// ${CANARY_SOLUTION}`, solutionLanguageId: 'c11' })
    await addTestcases(pid, [{ input: '1', expected: '1' }])
    itemId = await makeItem(courseId, pid)
  })

  async function submit(u: TestUser, o: Sub = {}): Promise<string> {
    const [row] = await q<{ id: string }>(sql`
      INSERT INTO submissions (kind, user_id, problem_id, item_id, contest_id, contest_problem_id, language_id,
                               source, source_bytes, status, verdict, passed_weight, total_weight,
                               time_ms_max, memory_kb_max, compile_output, attempt, received_at)
      VALUES ('submit', ${u.id}, ${pid}, ${o.contest ? null : itemId}, ${o.contest?.contestId ?? null}, ${o.contest?.cpId ?? null},
              ${o.languageId ?? 'c11'}, ${o.source ?? `code cua ${u.email}`}, 10, 'done', ${o.verdict ?? 'AC'},
              ${o.verdict === 'AC' || !o.verdict ? 2 : 1}, 2, ${o.timeMs ?? 50}, ${o.memoryKb ?? 1000},
              'CANARY_COMPILE_LOG', 1, now() - make_interval(mins => ${o.minutesAgo ?? 0}))
      RETURNING id`)
    return row!.id
  }

  const list = (as: TestUser, qs = '') => call(`/api/member/solutions?itemId=${itemId}${qs}`, { as })
  const detail = (as: TestUser, id: string) => call(`/api/member/solutions/${id}?itemId=${itemId}`, { as })

  it('chưa AC: đóng với lý do not_solved và KHÔNG rò một byte source nào', async () => {
    await submit(fast, { source: 'SECRET_FAST' })
    await submit(stuck, { verdict: 'WA' })
    const res = await list(stuck)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ canAccess: false, reason: 'not_solved', mine: null, reference: null, peers: [] })
    expect(JSON.stringify(res.body)).not.toContain('SECRET_FAST')
    // Đường chi tiết cũng đóng.
    const id = await submit(fast, { source: 'SECRET_2' })
    expect((await detail(stuck, id)).status).toBe(403)
  })

  it('đã AC: danh sách là bài AC TỐT NHẤT mỗi người, không có WA, không có mình, không có người tắt chia sẻ', async () => {
    await submit(solver, { timeMs: 70 })
    await submit(fast, { timeMs: 100 })
    const fastBest = await submit(fast, { timeMs: 20, memoryKb: 900 })
    await submit(fast, { verdict: 'TLE', timeMs: 1 })
    await submit(shy, { timeMs: 5 })
    await q(sql`UPDATE users SET share_solutions = false WHERE id = ${shy.id}`)
    await submit(stuck, { verdict: 'WA', timeMs: 1 })

    const res = await list(solver)
    expect(res.body.data.canAccess).toBe(true)
    const peers = res.body.data.peers as { id: string; userId: string; timeMsMax: number; source?: string }[]
    expect(peers.map((p) => p.userId)).toEqual([fast.id])
    expect(peers[0]).toMatchObject({ id: fastBest, timeMsMax: 20, memoryKbMax: 900, isMine: false })
    // Danh sách không mang source; cũng không mang kết quả test / log biên dịch của ai.
    expect(peers[0]!.source).toBeUndefined()
    expect(JSON.stringify(peers)).not.toContain('CANARY_COMPILE_LOG')
    expect(Object.keys(peers[0]!)).not.toEqual(expect.arrayContaining(['results', 'compileOutput', 'passedWeight']))
    // Bài của mình có source sẵn cho màn so sánh.
    expect(res.body.data.mine).toMatchObject({ userId: solver.id, isMine: true, timeMsMax: 70 })
    expect(res.body.data.mine.source).toContain(solver.email)
  })

  it('lọc theo ngôn ngữ, sắp xếp theo thời gian / bộ nhớ / mới nhất', async () => {
    await submit(solver)
    await submit(fast, { timeMs: 30, memoryKb: 5000, languageId: 'c11', minutesAgo: 10 })
    await submit(shy, { timeMs: 60, memoryKb: 100, languageId: 'python3', minutesAgo: 1 })

    const byTime = (await list(solver)).body.data.peers.map((p: { userId: string }) => p.userId)
    expect(byTime).toEqual([fast.id, shy.id])
    const byMem = (await list(solver, '&sort=memory')).body.data.peers.map((p: { userId: string }) => p.userId)
    expect(byMem).toEqual([shy.id, fast.id])
    const recent = (await list(solver, '&sort=recent')).body.data.peers.map((p: { userId: string }) => p.userId)
    expect(recent).toEqual([shy.id, fast.id])
    const py = (await list(solver, '&languageId=python3')).body.data.peers.map((p: { userId: string }) => p.userId)
    expect(py).toEqual([shy.id])
  })

  it('chi tiết: có source; người tắt chia sẻ → 404; bài của bài khác → 404; bài của mình luôn xem được', async () => {
    await submit(solver)
    const fastId = await submit(fast, { source: 'int main() { return 7; }' })
    const shyId = await submit(shy, { source: 'SECRET_SHY' })
    await q(sql`UPDATE users SET share_solutions = false WHERE id = ${shy.id}`)

    const res = await detail(solver, fastId)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ userId: fast.id, source: 'int main() { return 7; }', isMine: false })
    expect(res.body.data.compileOutput).toBeUndefined()

    const hidden = await detail(solver, shyId)
    expect(hidden.status).toBe(404)
    expect(JSON.stringify(hidden.body)).not.toContain('SECRET_SHY')
    // Chính chủ vẫn xem được bài của mình dù tắt chia sẻ.
    expect((await detail(shy, shyId)).status).toBe(200)

    // Bài nộp thuộc bài KHÁC — không xem được qua handle của bài này.
    const other = await makeProblem(admin.id, { scopeCourseId: courseId })
    await addTestcases(other, [{ input: '1', expected: '1' }])
    const [row] = await q<{ id: string }>(sql`
      INSERT INTO submissions (kind, user_id, problem_id, language_id, source, source_bytes, status, verdict,
                               passed_weight, total_weight, attempt)
      VALUES ('submit', ${fast.id}, ${other}, 'c11', 'OTHER_SECRET', 12, 'done', 'AC', 1, 1, 1) RETURNING id`)
    expect((await detail(solver, row!.id)).status).toBe(404)
  })

  it('lời giải mẫu theo đúng ba chế độ FR-D7; staff luôn thấy', async () => {
    await submit(solver)
    // mặc định 'mentor': member không thấy dù đã AC.
    expect((await list(solver)).body.data.reference).toBeNull()
    expect((await list(mentor)).body.data.reference).toMatchObject({ languageId: 'c11' })
    expect((await list(mentor)).body.data.reference.source).toContain(CANARY_SOLUTION)

    await q(sql`UPDATE problems SET solution_visibility = 'after_ac' WHERE id = ${pid}`)
    expect((await list(solver)).body.data.reference.source).toContain(CANARY_SOLUTION)
    // Chưa AC thì vẫn đóng cả gói — không có đường "after_ac" cho người chưa AC.
    expect(JSON.stringify((await list(stuck)).body)).not.toContain(CANARY_SOLUTION)

    // after_contest: chỉ khi contest đã kết thúc (handle contest).
    await q(sql`UPDATE problems SET solution_visibility = 'after_contest' WHERE id = ${pid}`)
    const [ct] = await q<{ id: string }>(sql`
      INSERT INTO contests (title, course_id, start_at, end_at, status)
      VALUES ('C', NULL, now() - interval '3 hours', now() - interval '1 hour', 'published') RETURNING id`)
    const [cp] = await q<{ id: string }>(sql`
      INSERT INTO contest_problems (contest_id, problem_id, position, label, max_score)
      VALUES (${ct!.id}, ${pid}, 1, 'A', 100) RETURNING id`)
    const viaContest = await call(`/api/member/solutions?contestProblemId=${cp!.id}`, { as: solver })
    expect(viaContest.body.data.reference.source).toContain(CANARY_SOLUTION)
    // Qua handle khoá thì không có contest nào để "kết thúc" → null.
    expect((await list(solver)).body.data.reference).toBeNull()
  })

  it('cấm vận: bài đang trong contest mở → đóng với mọi member (kể cả AC qua khoá), staff thì không', async () => {
    await submit(solver)
    const fastId = await submit(fast)
    const [ct] = await q<{ id: string }>(sql`
      INSERT INTO contests (title, course_id, start_at, end_at, status)
      VALUES ('C', NULL, now() - interval '1 hour', now() + interval '5 hours', 'published') RETURNING id`)
    await q(sql`INSERT INTO contest_problems (contest_id, problem_id, position, label, max_score) VALUES (${ct!.id}, ${pid}, 1, 'A', 100)`)

    const res = await list(solver)
    expect(res.body.data).toMatchObject({ canAccess: false, reason: 'contest_embargo', peers: [] })
    expect(res.body.data.embargoUntil).toBeTruthy()
    expect((await detail(solver, fastId)).status).toBe(403)
    expect((await list(mentor)).body.data.canAccess).toBe(true)

    // Contest nháp không cấm vận; contest đã kết thúc cũng không.
    await q(sql`UPDATE contests SET status = 'draft' WHERE id = ${ct!.id}`)
    expect((await list(solver)).body.data.canAccess).toBe(true)
    await q(sql`UPDATE contests SET status = 'published', end_at = now() - interval '1 minute' WHERE id = ${ct!.id}`)
    expect((await list(solver)).body.data.canAccess).toBe(true)
  })

  it('công tắc chia sẻ: PATCH /auth/me, /auth/me phản ánh, danh sách người khác đổi theo', async () => {
    await submit(solver)
    await submit(fast)
    expect((await call('/auth/me', { as: fast })).body.data.shareSolutions).toBe(true)
    expect((await list(solver)).body.data.peers).toHaveLength(1)

    const off = await call('/auth/me', { as: fast, method: 'PATCH', body: { shareSolutions: false } })
    expect(off.status).toBe(200)
    expect(off.body.data).toEqual({ shareSolutions: false })
    expect((await call('/auth/me', { as: fast })).body.data.shareSolutions).toBe(false)
    expect((await list(solver)).body.data.peers).toHaveLength(0)

    // Không gửi gì → 400; đổi tên vẫn chạy như cũ.
    expect((await call('/auth/me', { as: fast, method: 'PATCH', body: {} })).status).toBe(400)
    const ten = await call('/auth/me', { as: fast, method: 'PATCH', body: { displayName: '  Nhanh  ' } })
    expect(ten.body.data).toEqual({ displayName: 'Nhanh' })
  })

  it('cổng truy cập của đề: chưa ghi danh → 404', async () => {
    const ngoai = await makeUser('member')
    expect((await list(ngoai)).status).toBe(404)
  })
})
