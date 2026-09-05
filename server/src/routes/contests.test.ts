/** FR-I: contest tuần — embargo, cửa sổ tính điểm, xếp hạng, đóng băng, luyện tập. */
import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { computeStandings, cutoffFor } from '@/contest/standings'
import { q } from '@/db/pool'
import {
  INTEGRATION,
  addTestcases,
  assignMentor,
  call,
  enroll,
  makeCourse,
  makeProblem,
  makeUser,
  resetDb,
  setupDb,
  type TestUser,
} from '@/testing/harness'

describe.skipIf(!INTEGRATION)('contest (FR-I)', () => {
  let admin: TestUser
  let mentor: TestUser
  let member: TestUser
  let other: TestUser
  let problemA: string
  let problemB: string
  let courseId: string

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    admin = await makeUser('admin')
    mentor = await makeUser('mentor')
    member = await makeUser('member')
    other = await makeUser('member')
    const course = await makeCourse(mentor.id)
    courseId = course.id
    await assignMentor(courseId, mentor.id)
    await enroll(courseId, member.id)
    await enroll(courseId, other.id)
    problemA = await makeProblem(mentor.id, { title: 'Bài A' })
    problemB = await makeProblem(mentor.id, { title: 'Bài B' })
    for (const p of [problemA, problemB]) {
      await addTestcases(p, [{ input: '1\n', expected: '1\n', kind: 'sample' }])
      await q(sql`UPDATE problems SET validated_testcase_rev = testcase_rev, validated_at = now() WHERE id = ${p}`)
    }
  })

  async function makeContest(opts: { startOffsetMin: number; endOffsetMin: number; freezeMinutes?: number }) {
    const [row] = await q<{ id: string }>(sql`
      INSERT INTO contests (title, course_id, start_at, end_at, status, freeze_minutes)
      VALUES ('Tuần 36', ${courseId},
              now() + make_interval(mins => ${opts.startOffsetMin}),
              now() + make_interval(mins => ${opts.endOffsetMin}),
              'published', ${opts.freezeMinutes ?? 0})
      RETURNING id
    `)
    const problems = await q<{ id: string }>(sql`
      INSERT INTO contest_problems (contest_id, problem_id, position, label, max_score)
      VALUES (${row!.id}, ${problemA}, 1, 'A', 100), (${row!.id}, ${problemB}, 2, 'B', 100)
      RETURNING id
    `)
    return { contestId: row!.id, cpA: problems[0]!.id, cpB: problems[1]!.id }
  }

  async function scoreSubmission(
    userId: string,
    contestId: string,
    contestProblemId: string,
    problemId: string,
    opts: { verdict: string; passed: number; total: number; minutesAgo: number },
  ) {
    await q(sql`
      INSERT INTO submissions (kind, user_id, problem_id, contest_id, contest_problem_id, language_id,
                               source, source_bytes, status, verdict, passed_weight, total_weight,
                               attempt, received_at)
      VALUES ('submit', ${userId}, ${problemId}, ${contestId}, ${contestProblemId}, 'c11', 'x', 1,
              'done', ${opts.verdict}, ${opts.passed}, ${opts.total}, 1,
              now() - make_interval(mins => ${opts.minutesAgo}))
    `)
  }

  it('FR-I3: trước giờ bắt đầu KHÔNG trả đề, chỉ metadata + đếm ngược', async () => {
    const { contestId, cpA } = await makeContest({ startOffsetMin: 60, endOffsetMin: 10_080 })
    const res = await call(`/api/member/contests/${contestId}`, { as: member })
    expect(res.status).toBe(200)
    expect(res.body.data.phase).toBe('sap-dien-ra')
    expect(res.body.data.problems).toEqual([])
    expect(res.body.data.problemCount).toBe(2)
    expect(res.body.meta.serverTime).toBeTruthy()

    // Đi cửa sau cũng không được: mở thẳng đề của contest chưa bắt đầu.
    const direct = await call(`/api/member/problems?contestProblemId=${cpA}`, { as: member })
    expect(direct.status).toBe(403)
    expect(direct.body.error.code).toBe('forbidden')
  })

  it('FR-I3: từ giờ bắt đầu thì đề mở ra', async () => {
    const { contestId, cpA } = await makeContest({ startOffsetMin: -10, endOffsetMin: 10_080 })
    const res = await call(`/api/member/contests/${contestId}`, { as: member })
    expect(res.body.data.phase).toBe('dang-dien-ra')
    expect(res.body.data.problems).toHaveLength(2)
    expect((await call(`/api/member/problems?contestProblemId=${cpA}`, { as: member })).status).toBe(200)
  })

  it('member ngoài phạm vi contest không thấy gì', async () => {
    const { contestId } = await makeContest({ startOffsetMin: -10, endOffsetMin: 100 })
    const outsider = await makeUser('member')
    expect((await call(`/api/member/contests/${contestId}`, { as: outsider })).status).toBe(404)
  })

  it('FR-I5: xếp theo tổng điểm, hoà thì người đạt điểm sớm hơn xếp trên', async () => {
    const { contestId, cpA, cpB } = await makeContest({ startOffsetMin: -120, endOffsetMin: 120 })
    // member: A đủ điểm (30 phút trước), B nửa điểm
    await scoreSubmission(member.id, contestId, cpA, problemA, { verdict: 'AC', passed: 2, total: 2, minutesAgo: 30 })
    await scoreSubmission(member.id, contestId, cpB, problemB, { verdict: 'WA', passed: 1, total: 2, minutesAgo: 20 })
    // other: cùng tổng điểm nhưng đạt muộn hơn
    await scoreSubmission(other.id, contestId, cpA, problemA, { verdict: 'AC', passed: 2, total: 2, minutesAgo: 10 })
    await scoreSubmission(other.id, contestId, cpB, problemB, { verdict: 'WA', passed: 1, total: 2, minutesAgo: 5 })

    const rows = await computeStandings(contestId, { cutoff: 'infinity', meId: member.id })
    expect(rows[0]?.totalPoints).toBe(150)
    expect(rows[1]?.totalPoints).toBe(150)
    expect(rows[0]?.userId).toBe(member.id) // đạt điểm cuối sớm hơn
    expect(rows[0]?.rank).toBe(1)
    expect(rows[0]?.acCount).toBe(1)
  })

  it('FR-I4: bài nộp NGOÀI cửa sổ không tính vào bảng xếp hạng', async () => {
    const { contestId, cpA } = await makeContest({ startOffsetMin: -60, endOffsetMin: -10 })
    // Nộp sau khi contest đã kết thúc (10 phút trước là sau end_at).
    await scoreSubmission(member.id, contestId, cpA, problemA, { verdict: 'AC', passed: 2, total: 2, minutesAgo: 5 })
    const rows = await computeStandings(contestId, { cutoff: 'infinity', meId: member.id })
    expect(rows).toHaveLength(0)
  })

  it('NFR-5: tính theo THỜI ĐIỂM NHẬN, không phải lúc chấm xong', async () => {
    const { contestId, cpA } = await makeContest({ startOffsetMin: -60, endOffsetMin: -1 })
    // received_at còn trong cửa sổ (2 phút trước end), finished_at sau khi hết giờ.
    await q(sql`
      INSERT INTO submissions (kind, user_id, problem_id, contest_id, contest_problem_id, language_id,
                               source, source_bytes, status, verdict, passed_weight, total_weight,
                               attempt, received_at, finished_at)
      VALUES ('submit', ${member.id}, ${problemA}, ${contestId}, ${cpA}, 'c11', 'x', 1,
              'done', 'AC', 2, 2, 1, now() - interval '3 minutes', now())
    `)
    const rows = await computeStandings(contestId, { cutoff: 'infinity', meId: member.id })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.totalPoints).toBe(100)
  })

  it('FR-I10: đóng băng giấu điểm mới với member, mentor vẫn thấy', async () => {
    const { contestId, cpA } = await makeContest({ startOffsetMin: -60, endOffsetMin: 30, freezeMinutes: 60 })
    await scoreSubmission(member.id, contestId, cpA, problemA, { verdict: 'AC', passed: 2, total: 2, minutesAgo: 5 })

    const endAt = new Date(Date.now() + 30 * 60_000)
    const memberCutoff = cutoffFor({ endAt, freezeMinutes: 60 }, false)
    const staffCutoff = cutoffFor({ endAt, freezeMinutes: 60 }, true)
    expect(staffCutoff).toBe('infinity')

    const frozen = await computeStandings(contestId, { cutoff: memberCutoff, meId: member.id })
    const full = await computeStandings(contestId, { cutoff: staffCutoff, meId: member.id })
    expect(frozen).toHaveLength(0)
    expect(full).toHaveLength(1)
  })

  it('FR-I10: đóng băng có hiệu lực trên ROUTE member, không chỉ trong hàm tính', async () => {
    // Ca trên gọi thẳng computeStandings/cutoffFor. Đường dây từ route tới hàm thì
    // chưa ai kiểm: truyền `true` thay cho `contest.isStaff` ở member/contests.ts làm
    // mọi thí sinh xem được bảng điểm trực tiếp trong N phút cuối, mà 209 test vẫn
    // xanh. FR-I10 hỏng hoàn toàn đúng lúc nó quan trọng nhất.
    const { contestId, cpA } = await makeContest({ startOffsetMin: -60, endOffsetMin: 30, freezeMinutes: 60 })
    await scoreSubmission(member.id, contestId, cpA, problemA, { verdict: 'AC', passed: 2, total: 2, minutesAgo: 5 })

    const cuaMember = await call(`/api/member/contests/${contestId}/standings`, { as: member })
    expect(cuaMember.status).toBe(200)
    expect(cuaMember.body.data).toHaveLength(0)

    // Đối chứng: mentor gọi CÙNG route đó vẫn phải thấy — nếu không thì "đóng băng"
    // chỉ là route hỏng chứ không phải cơ chế hoạt động (isStaff suy ra trong route).
    const cuaMentor = await call(`/api/member/contests/${contestId}/standings`, { as: mentor })
    expect(cuaMentor.status).toBe(200)
    expect(cuaMentor.body.data).toHaveLength(1)
  })

  it('bảng xếp hạng lấy lần nộp TỐT NHẤT của mỗi bài, không phải lần cuối', async () => {
    // standings.ts sắp `passed_weight/total_weight DESC` để chọn lần tốt nhất, nhưng
    // trong cả file này mỗi người chỉ nộp MỘT lần mỗi bài nên thứ tự đó chưa bao giờ
    // có tác dụng. Đổi DESC thành ASC (lấy lần TỆ nhất) vẫn xanh 209 test — mà nghĩa
    // của nó là người học sửa bài rồi nộp lại bị giữ điểm thấp cũ suốt contest.
    const { contestId, cpA } = await makeContest({ startOffsetMin: -60, endOffsetMin: 60 })
    await scoreSubmission(member.id, contestId, cpA, problemA, { verdict: 'WA', passed: 1, total: 2, minutesAgo: 20 })
    await scoreSubmission(member.id, contestId, cpA, problemA, { verdict: 'AC', passed: 2, total: 2, minutesAgo: 10 })

    const rows = await computeStandings(contestId, { cutoff: 'infinity', meId: member.id })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.totalPoints).toBe(100)
  })

  it('FR-I10: hết giờ thì mở băng lại', async () => {
    const endAt = new Date(Date.now() - 60_000)
    expect(cutoffFor({ endAt, freezeMinutes: 60 }, false)).toBe('infinity')
  })

  it('FR-I6: sau khi kết thúc vẫn nộp được, nhưng không đổi bảng xếp hạng', async () => {
    const { contestId, cpA } = await makeContest({ startOffsetMin: -120, endOffsetMin: -10 })
    const posted = await call('/api/member/submissions', {
      as: member,
      body: { contestProblemId: cpA, languageId: 'c11', source: 'int main(){}' },
    })
    expect(posted.status).toBe(201) // luyện tập: vẫn nhận
    await q(sql`UPDATE submissions SET status='done', verdict='AC', passed_weight=2, total_weight=2`)
    const rows = await computeStandings(contestId, { cutoff: 'infinity', meId: member.id })
    expect(rows).toHaveLength(0) // nhưng ngoài cửa sổ nên không tính
  })

  it('FR-I8: contest mở tuần tự — chưa AC bài trước thì bài sau khoá', async () => {
    const { contestId, cpA, cpB } = await makeContest({ startOffsetMin: -10, endOffsetMin: 100 })
    await q(sql`UPDATE contests SET sequential = true WHERE id = ${contestId}`)

    // Bài 1 mở sẵn; bài 2 khoá.
    expect((await call(`/api/member/problems?contestProblemId=${cpA}`, { as: member })).status).toBe(200)
    const locked = await call(`/api/member/problems?contestProblemId=${cpB}`, { as: member })
    expect(locked.status).toBe(403)

    // AC bài 1 → bài 2 mở ra.
    await scoreSubmission(member.id, contestId, cpA, problemA, { verdict: 'AC', passed: 1, total: 1, minutesAgo: 1 })
    expect((await call(`/api/member/problems?contestProblemId=${cpB}`, { as: member })).status).toBe(200)
  })

  it('FR-I8: mentor không bị khoá tuần tự (xem trước được toàn bộ)', async () => {
    const { contestId, cpB } = await makeContest({ startOffsetMin: -10, endOffsetMin: 100 })
    await q(sql`UPDATE contests SET sequential = true WHERE id = ${contestId}`)
    expect((await call(`/api/member/problems?contestProblemId=${cpB}`, { as: mentor })).status).toBe(200)
  })

  it('FR-J5: bảng xếp hạng gộp theo team', async () => {
    const { contestId, cpA } = await makeContest({ startOffsetMin: -60, endOffsetMin: 60 })
    await scoreSubmission(member.id, contestId, cpA, problemA, { verdict: 'AC', passed: 1, total: 1, minutesAgo: 10 })
    await scoreSubmission(other.id, contestId, cpA, problemA, { verdict: 'WA', passed: 0, total: 1, minutesAgo: 5 })

    const team = await call('/api/admin/teams', { as: admin, body: { name: 'Alpha', leaderId: member.id } })
    await call(`/api/admin/teams/${team.body.data.id}/members`, { as: admin, body: { userId: other.id } })

    const res = await call(`/api/member/contests/${contestId}/standings?groupBy=team`, { as: member })
    expect(res.status).toBe(200)
    expect(res.body.meta.groupBy).toBe('team')
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].teamName).toBe('Alpha')
    expect(res.body.data[0].totalPoints).toBe(100)
    expect(res.body.data[0].members).toBe(2)
  })

  it('FR-I2: chỉ admin tạo được contest toàn CLB', async () => {
    const body = {
      title: 'Toàn CLB',
      courseId: null,
      startAt: new Date(Date.now() + 3600_000).toISOString(),
      endAt: new Date(Date.now() + 7200_000).toISOString(),
    }
    expect((await call('/api/mentor/contests', { as: mentor, body })).status).toBe(403)
    expect((await call('/api/mentor/contests', { as: admin, body })).status).toBe(201)
  })

  it('FR-I2: xuất bản là cổng MỀM — cảnh báo rồi cho qua khi xác nhận', async () => {
    // Bài B chưa validate.
    await q(sql`UPDATE problems SET validated_testcase_rev = NULL WHERE id = ${problemB}`)
    const { contestId } = await makeContest({ startOffsetMin: 60, endOffsetMin: 10_080 })
    await q(sql`UPDATE contests SET status = 'draft' WHERE id = ${contestId}`)

    const blocked = await call(`/api/mentor/contests/${contestId}/publish`, { as: mentor, body: {} })
    expect(blocked.status).toBe(409)
    expect(blocked.body.error.code).toBe('publish_validation_failed')

    const forced = await call(`/api/mentor/contests/${contestId}/publish`, { as: mentor, body: { confirm: true } })
    expect(forced.status).toBe(200)
  })

  it('FR-I2: bài thiếu testcase bị chặn CỨNG, xác nhận cũng không qua', async () => {
    await q(sql`DELETE FROM testcases WHERE problem_id = ${problemB}`)
    const { contestId } = await makeContest({ startOffsetMin: 60, endOffsetMin: 10_080 })
    const res = await call(`/api/mentor/contests/${contestId}/publish`, { as: mentor, body: { confirm: true } })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('no_testcases')
  })

  it('FR-I9: nhân bản dời +7 ngày và để TRỐNG danh sách bài (US-10)', async () => {
    const { contestId } = await makeContest({ startOffsetMin: -60, endOffsetMin: 60 })
    const res = await call(`/api/mentor/contests/${contestId}/clone`, { as: mentor, body: {} })
    expect(res.status).toBe(201)

    const [clone] = await q<{ start_at: string; status: string; n: number }>(sql`
      SELECT c.start_at, c.status,
             (SELECT count(*)::int FROM contest_problems cp WHERE cp.contest_id = c.id) AS n
      FROM contests c WHERE c.id = ${res.body.data.id}
    `)
    expect(clone?.status).toBe('draft')
    expect(clone?.n).toBe(0)
    // Câu SQL trên vẫn SELECT start_at nhưng trước đây không ai khẳng định nó — đúng
    // con số nằm trong tên test. Đổi `interval '7 days'` thành '0 days' thì cả bộ vẫn
    // xanh, và mentor nhân bản contest tuần sau sẽ thấy nó mở ra ngay hôm nay: đề lộ
    // trước giờ thi.
    const goc = await q<{ start_at: string }>(sql`SELECT start_at FROM contests WHERE id = ${contestId}`)
    const cachNhauMs = new Date(clone!.start_at).getTime() - new Date(goc[0]!.start_at).getTime()
    expect(Math.round(cachNhauMs / 86_400_000)).toBe(7)
  })

  it('FR-I7: thống kê phân biệt "đã mở" với "đã nộp"', async () => {
    const { contestId, cpA } = await makeContest({ startOffsetMin: -60, endOffsetMin: 60 })
    await call(`/api/member/contests/${contestId}`, { as: member })
    await call(`/api/member/contests/${contestId}`, { as: other })
    await scoreSubmission(member.id, contestId, cpA, problemA, { verdict: 'AC', passed: 2, total: 2, minutesAgo: 5 })

    const res = await call(`/api/mentor/contests/${contestId}/stats`, { as: mentor })
    expect(res.body.data.opened).toBe(2)
    expect(res.body.data.submitted).toBe(1)
    expect(res.body.data.notSubmitted.map((r: { id: string }) => r.id)).toEqual([other.id])
  })
})
