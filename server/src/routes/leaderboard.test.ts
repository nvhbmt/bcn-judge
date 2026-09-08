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
import { getSettings, maxPointsFor } from '@/lib/settings'
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

/**
 * Điểm theo độ khó (FR-F2 v0.8) và thứ tự "tổng điểm trước" (FR-G6 v0.8).
 *
 * Điều được canh: hệ số sống ở settings và công thức chỉ ở MỘT chỗ (`bestSubmissions`),
 * nên đổi ở Cài đặt là mọi bảng đổi theo mà không chấm lại; bản SQL và bản TypeScript
 * (`maxPointsFor`) của cùng luật không được trôi khỏi nhau.
 */
describe.skipIf(!INTEGRATION)('điểm theo độ khó', () => {
  let admin: TestUser
  let uA: TestUser
  let uB: TestUser
  let courseId: string
  let pEasy: string
  let pHard: string
  let pNull: string
  let iEasy: string
  let iHard: string
  let iNull: string

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    admin = await makeUser('admin')
    uA = await makeUser('member')
    uB = await makeUser('member')
    const course = await makeCourse(admin.id, { status: 'open' })
    courseId = course.id
    for (const u of [uA, uB]) await enroll(courseId, u.id)
    pEasy = await makeProblem(admin.id, { scopeCourseId: courseId, difficulty: 'easy' })
    pHard = await makeProblem(admin.id, { scopeCourseId: courseId, difficulty: 'hard' })
    pNull = await makeProblem(admin.id, { scopeCourseId: courseId })
    for (const p of [pEasy, pHard, pNull]) await addTestcases(p, [{ input: '1', expected: '1' }])
    iEasy = await makeItem(courseId, pEasy)
    iHard = await makeItem(courseId, pHard)
    iNull = await makeItem(courseId, pNull)
  })

  const syllabusOf = async (u: TestUser) =>
    (await call(`/api/member/courses/${courseId}/syllabus`, { as: u })).body.data
      .flatMap((s: { items: unknown[] }) => s.items) as { id: string; points: number | null; maxPoints: number | null }[]

  it('điểm tích luỹ = tỉ lệ × điểm tối đa theo độ khó; chưa đặt độ khó dùng points_unset', async () => {
    await submit(uA.id, iEasy, pEasy, { verdict: 'AC', passed: 2, total: 2 })
    await submit(uA.id, iHard, pHard, { verdict: 'WA', passed: 1, total: 2 })
    await submit(uA.id, iNull, pNull, { verdict: 'AC', passed: 2, total: 2 })

    const items = await syllabusOf(uA)
    expect(items.find((i) => i.id === iEasy)).toMatchObject({ points: 100, maxPoints: 100 })
    expect(items.find((i) => i.id === iHard)).toMatchObject({ points: 100, maxPoints: 200 }) // nửa bài khó
    expect(items.find((i) => i.id === iNull)).toMatchObject({ points: 100, maxPoints: 100 })

    // Mục chưa nộp vẫn mang maxPoints để giáo trình nói "0/150".
    const cuaB = await syllabusOf(uB)
    expect(cuaB.find((i) => i.id === iHard)).toMatchObject({ points: null, maxPoints: 200 })
  })

  it('đề bài mang maxPoints đúng theo độ khó (member lẫn mentor)', async () => {
    const member = await call(`/api/member/problems?itemId=${iHard}`, { as: uA })
    expect(member.body.data.maxPoints).toBe(200)
    const mentor = await call(`/api/mentor/problems/${pEasy}`, { as: admin })
    expect(mentor.body.data.maxPoints).toBe(100)
  })

  it('xếp theo TỔNG ĐIỂM trước, rồi số bài AC — khác thứ tự AC-trước cũ', async () => {
    // uA: 1 AC khó (200) + nửa bài dễ (50) = 250 điểm, 1 AC.
    await submit(uA.id, iHard, pHard, { verdict: 'AC', passed: 2, total: 2 })
    await submit(uA.id, iEasy, pEasy, { verdict: 'WA', passed: 1, total: 2 })
    // uB: 2 AC dễ/chưa-đặt = 200 điểm, 2 AC. Thứ tự cũ (AC trước) đặt uB trên.
    await submit(uB.id, iEasy, pEasy, { verdict: 'AC', passed: 2, total: 2 })
    await submit(uB.id, iNull, pNull, { verdict: 'AC', passed: 2, total: 2 })

    const global = await call('/api/member/leaderboard?scope=individual&window=all', { as: uA })
    expect(global.body.data.map((r: { userId: string }) => r.userId)).toEqual([uA.id, uB.id])
    expect(global.body.data[0]).toMatchObject({ totalPoints: 250, acCount: 1 })
    expect(global.body.data[1]).toMatchObject({ totalPoints: 200, acCount: 2 })

    const course = await call(`/api/member/courses/${courseId}/leaderboard`, { as: uA })
    expect(course.body.data.map((r: { userId: string }) => r.userId)).toEqual([uA.id, uB.id])

    // Hoà điểm thì AC nhiều hơn xếp trên: cho uA thêm... không — cho uB thêm nửa bài khó
    // (+100) để bằng 350? Không cần: chỉ cần uB = 250 bằng uA. Nửa bài dễ của uA đã 50;
    // uB thêm một phần tư bài khó (50) → 250 điểm, 2 AC → uB lên trên.
    await submit(uB.id, iHard, pHard, { verdict: 'WA', passed: 1, total: 4 })
    const hoa = await call('/api/member/leaderboard?scope=individual&window=all', { as: uA })
    expect(hoa.body.data.map((r: { userId: string }) => r.userId)).toEqual([uB.id, uA.id])
    expect(hoa.body.data[0]).toMatchObject({ totalPoints: 250, acCount: 2 })
  })

  it('team cũng xếp theo tổng điểm trước', async () => {
    const alpha = (await call('/api/admin/teams', { as: admin, body: { name: 'Alpha', leaderId: uA.id } })).body.data.id
    const beta = (await call('/api/admin/teams', { as: admin, body: { name: 'Beta', leaderId: uB.id } })).body.data.id
    await submit(uA.id, iHard, pHard, { verdict: 'AC', passed: 2, total: 2 }) // Alpha 200, 1 AC
    await submit(uB.id, iEasy, pEasy, { verdict: 'AC', passed: 2, total: 2 })
    await submit(uB.id, iNull, pNull, { verdict: 'WA', passed: 1, total: 2 }) // Beta 150, 1 AC

    for (const path of ['/api/member/leaderboard?scope=team&window=all', '/api/member/teams/standings']) {
      const res = await call(path, { as: uA })
      expect(res.body.data.map((r: { id: string }) => r.id)).toEqual([alpha, beta])
    }
  })

  it('đổi hệ số ở Cài đặt → điểm và thứ hạng đổi ngay, không cần chấm lại', async () => {
    await submit(uA.id, iHard, pHard, { verdict: 'AC', passed: 2, total: 2 }) // 200
    await submit(uB.id, iEasy, pEasy, { verdict: 'AC', passed: 2, total: 2 }) // 100
    await submit(uB.id, iNull, pNull, { verdict: 'AC', passed: 2, total: 2 }) // 100 → 200, 2 AC (hoà, uB trên)

    let res = await call('/api/member/leaderboard?scope=individual&window=all', { as: uA })
    expect(res.body.data.map((r: { userId: string }) => r.userId)).toEqual([uB.id, uA.id])

    await call('/api/admin/settings', { as: admin, method: 'PATCH', body: { points_hard: 500 } })
    res = await call('/api/member/leaderboard?scope=individual&window=all', { as: uA })
    expect(res.body.data[0]).toMatchObject({ userId: uA.id, totalPoints: 500 })

    await call('/api/admin/settings', { as: admin, method: 'PATCH', body: { points_hard: 50 } })
    res = await call('/api/member/leaderboard?scope=individual&window=all', { as: uA })
    expect(res.body.data.map((r: { userId: string }) => r.userId)).toEqual([uB.id, uA.id])
    expect(res.body.data[1].totalPoints).toBe(50)
  })

  it('SQL và TypeScript là MỘT luật: max_points của bestSubmissions khớp maxPointsFor', async () => {
    await call('/api/admin/settings', {
      as: admin,
      method: 'PATCH',
      body: { points_easy: 7, points_medium: 11, points_hard: 13, points_unset: 17 },
    })
    const pMedium = await makeProblem(admin.id, { scopeCourseId: courseId, difficulty: 'medium' })
    const iMedium = await makeItem(courseId, pMedium)
    const items = await syllabusOf(uA)
    const s = await getSettings()
    for (const [id, difficulty] of [
      [iEasy, 'easy'],
      [iMedium, 'medium'],
      [iHard, 'hard'],
      [iNull, null],
    ] as const) {
      expect(items.find((i) => i.id === id)!.maxPoints).toBe(maxPointsFor(difficulty, s))
    }
  })

  it('điểm của MỘT bài nộp vẫn là thang 0–100 — chỉ điểm tích luỹ đổi', async () => {
    await submit(uA.id, iHard, pHard, { verdict: 'WA', passed: 1, total: 2 })
    const res = await call(`/api/member/submissions?itemId=${iHard}`, { as: uA })
    expect(res.body.data[0].score).toBe(50)
  })
})

/**
 * BXH toàn ban gộp contest (v0.8): ba nguồn điểm, contest thuộc kỳ theo `end_at`, mốc
 * đóng băng được tôn trọng, contest nháp/ngoài cửa sổ không tính, và `source=practice`
 * phải trả ĐÚNG con số của bản trước — đó là lưới hồi quy cho phần gộp.
 */
describe.skipIf(!INTEGRATION)('BXH toàn ban gộp contest', () => {
  let admin: TestUser
  let u1: TestUser
  let u2: TestUser
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
    const course = await makeCourse(admin.id, { status: 'open' })
    courseId = course.id
    for (const u of [u1, u2]) await enroll(courseId, u.id)
    p1 = await makeProblem(admin.id, { scopeCourseId: courseId, difficulty: 'easy' })
    await addTestcases(p1, [{ input: '1', expected: '1' }])
    item1 = await makeItem(courseId, p1)
  })

  /** Contest toàn ban (course_id NULL) với một bài 100 điểm; mốc tính bằng phút so với now(). */
  async function makeContest(o: { startMin: number; endMin: number; status?: string; freezeMinutes?: number; maxScore?: number }) {
    const [row] = await q<{ id: string }>(sql`
      INSERT INTO contests (title, course_id, start_at, end_at, status, freeze_minutes)
      VALUES ('Contest', NULL, now() + make_interval(mins => ${o.startMin}), now() + make_interval(mins => ${o.endMin}),
              ${o.status ?? 'published'}, ${o.freezeMinutes ?? 0})
      RETURNING id
    `)
    const [cp] = await q<{ id: string }>(sql`
      INSERT INTO contest_problems (contest_id, problem_id, position, label, max_score)
      VALUES (${row!.id}, ${p1}, 1, 'A', ${o.maxScore ?? 100}) RETURNING id
    `)
    return { contestId: row!.id, cpId: cp!.id }
  }

  async function contestSubmit(u: TestUser, c: { contestId: string; cpId: string }, o: { verdict: string; passed: number; total: number; minutesAgo: number }) {
    await q(sql`
      INSERT INTO submissions (kind, user_id, problem_id, contest_id, contest_problem_id, language_id, source, source_bytes,
                               status, verdict, passed_weight, total_weight, attempt, received_at)
      VALUES ('submit', ${u.id}, ${p1}, ${c.contestId}, ${c.cpId}, 'c11', 'x', 1, 'done', ${o.verdict}, ${o.passed}, ${o.total}, 1,
              now() - make_interval(mins => ${o.minutesAgo}))
    `)
  }

  const board = async (qs: string, as = admin) => (await call(`/api/member/leaderboard?${qs}`, { as })).body.data
  const rowOf = (rows: { userId: string }[], u: TestUser) => rows.find((r) => r.userId === u.id)

  it('ba nguồn: Tổng hợp = luyện + contest; Bài luyện trả đúng con số cũ; Contest chỉ contest', async () => {
    const c = await makeContest({ startMin: -120, endMin: -60 })
    await submit(u1.id, item1, p1, { verdict: 'AC', passed: 2, total: 2 }) // luyện 100
    await contestSubmit(u1, c, { verdict: 'WA', passed: 1, total: 2, minutesAgo: 90 }) // contest 50
    await contestSubmit(u2, c, { verdict: 'AC', passed: 2, total: 2, minutesAgo: 80 }) // contest 100, không luyện

    const total = await board('scope=individual&window=all&source=total')
    expect(rowOf(total, u1)).toMatchObject({ totalPoints: 150, acCount: 1, practicePoints: 100, contestPoints: 50 })
    expect(rowOf(total, u2)).toMatchObject({ totalPoints: 100, acCount: 1, practicePoints: 0, contestPoints: 100 })
    expect(total.map((r: { userId: string }) => r.userId)).toEqual([u1.id, u2.id])

    // Mặc định = Tổng hợp.
    expect(await board('scope=individual&window=all')).toEqual(total)

    const practice = await board('scope=individual&window=all&source=practice')
    expect(practice).toHaveLength(1)
    expect(rowOf(practice, u1)).toMatchObject({ totalPoints: 100, acCount: 1 })

    const contest = await board('scope=individual&window=all&source=contest')
    expect(contest.map((r: { userId: string }) => r.userId)).toEqual([u2.id, u1.id])
    expect(rowOf(contest, u1)).toMatchObject({ totalPoints: 50, acCount: 0 })
  })

  it('contest thuộc kỳ mà nó KẾT THÚC: xong 10 ngày trước → không vào tuần, vào tháng/toàn thời gian', async () => {
    const cu = await makeContest({ startMin: -20 * 24 * 60, endMin: -10 * 24 * 60 })
    await contestSubmit(u1, cu, { verdict: 'AC', passed: 2, total: 2, minutesAgo: 15 * 24 * 60 })
    // Lịch VN: đầu tháng có thể chỉ cách nay vài ngày → "tháng này" không chắc chứa mốc
    // 10 ngày trước; toàn thời gian thì luôn chứa.
    expect(rowOf(await board('window=week&source=contest'), u1)).toBeUndefined()
    expect(rowOf(await board('window=all&source=contest'), u1)).toMatchObject({ totalPoints: 100 })

    // Contest ĐANG chạy (end_at ở tương lai) tính vào kỳ hiện tại.
    const dang = await makeContest({ startMin: -60, endMin: 60 })
    await contestSubmit(u2, dang, { verdict: 'AC', passed: 2, total: 2, minutesAgo: 30 })
    expect(rowOf(await board('window=week&source=contest'), u2)).toMatchObject({ totalPoints: 100 })
  })

  it('đóng băng được tôn trọng: bài nộp sau mốc băng của contest đang chạy chưa tính, kể cả với admin', async () => {
    const c = await makeContest({ startMin: -120, endMin: 60, freezeMinutes: 90 }) // băng từ 30 phút trước
    await contestSubmit(u1, c, { verdict: 'AC', passed: 2, total: 2, minutesAgo: 10 }) // trong lúc băng
    await contestSubmit(u2, c, { verdict: 'WA', passed: 1, total: 2, minutesAgo: 60 }) // trước băng: 50

    const rows = await board('window=all&source=contest', admin)
    expect(rowOf(rows, u1)).toBeUndefined()
    expect(rowOf(rows, u2)).toMatchObject({ totalPoints: 50 })
  })

  it('contest nháp, contest chưa bắt đầu, và bài nộp ngoài cửa sổ không tính', async () => {
    const nhap = await makeContest({ startMin: -120, endMin: -60, status: 'draft' })
    await contestSubmit(u1, nhap, { verdict: 'AC', passed: 2, total: 2, minutesAgo: 90 })
    const c = await makeContest({ startMin: -120, endMin: -60 })
    await contestSubmit(u2, c, { verdict: 'AC', passed: 2, total: 2, minutesAgo: 30 }) // sau end_at → luyện tập, không tính
    expect(await board('window=all&source=contest')).toHaveLength(0)
  })

  it('team: cộng cả hai nguồn của mọi thành viên; team chưa có gì vẫn hiện 0', async () => {
    const alpha = (await call('/api/admin/teams', { as: admin, body: { name: 'Alpha', leaderId: u1.id } })).body.data.id
    const beta = (await call('/api/admin/teams', { as: admin, body: { name: 'Beta', leaderId: u2.id } })).body.data.id
    const c = await makeContest({ startMin: -120, endMin: -60 })
    await submit(u1.id, item1, p1, { verdict: 'AC', passed: 2, total: 2 })
    await contestSubmit(u1, c, { verdict: 'AC', passed: 2, total: 2, minutesAgo: 90 })

    const rows = await board('scope=team&window=all&source=total', u1)
    const a = rows.find((r: { id: string }) => r.id === alpha)
    const b = rows.find((r: { id: string }) => r.id === beta)
    expect(a).toMatchObject({ rank: 1, totalPoints: 200, practicePoints: 100, contestPoints: 100, acCount: 2, isMine: true })
    expect(b).toMatchObject({ rank: 2, totalPoints: 0, acCount: 0, memberCount: 1 })

    // Nguồn Bài luyện: Alpha 100, không mang điểm contest sang.
    const luyen = await board('scope=team&window=all&source=practice', u1)
    expect(luyen.find((r: { id: string }) => r.id === alpha)).toMatchObject({ totalPoints: 100, acCount: 1 })
  })
})
