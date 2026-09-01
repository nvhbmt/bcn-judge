/** FR-J: team & leader — quyền, bất biến, và chặn kênh chép bài trong contest. */
import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { q } from '../db/pool'
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
} from '../testing/harness'

describe.skipIf(!INTEGRATION)('team & leader (FR-J)', () => {
  let admin: TestUser
  let leader: TestUser
  let teammate: TestUser
  let outsider: TestUser
  let teamId: string

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    admin = await makeUser('admin')
    leader = await makeUser('member')
    teammate = await makeUser('member')
    outsider = await makeUser('member')

    const res = await call('/api/admin/teams', { as: admin, body: { name: 'Alpha', leaderId: leader.id } })
    expect(res.status).toBe(201)
    teamId = res.body.data.id
    await call(`/api/admin/teams/${teamId}/members`, { as: admin, body: { userId: teammate.id } })
  })

  it('chỉ admin tạo/sửa team được', async () => {
    for (const user of [leader, teammate]) {
      expect((await call('/api/admin/teams', { as: user, body: { name: 'X', leaderId: user.id } })).status).toBe(403)
      expect((await call(`/api/admin/teams/${teamId}/members`, { as: user, body: { userId: outsider.id } })).status).toBe(403)
    }
  })

  it('một member chỉ thuộc MỘT team (thông điệp tiếng Việt, không phải lỗi SQL)', async () => {
    const second = await call('/api/admin/teams', { as: admin, body: { name: 'Beta', leaderId: outsider.id } })
    const res = await call(`/api/admin/teams/${second.body.data.id}/members`, { as: admin, body: { userId: teammate.id } })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('already_in_team')
  })

  it('leader phải là thành viên của team', async () => {
    const res = await call(`/api/admin/teams/${teamId}/leader`, { as: admin, method: 'PUT', body: { userId: outsider.id } })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('leader_must_be_member')
  })

  it('không gỡ được thành viên đang là leader — phải đổi leader trước', async () => {
    const res = await call(`/api/admin/teams/${teamId}/members/${leader.id}`, { as: admin, method: 'DELETE' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('leader_must_be_member')

    await call(`/api/admin/teams/${teamId}/leader`, { as: admin, method: 'PUT', body: { userId: teammate.id } })
    const after = await call(`/api/admin/teams/${teamId}/members/${leader.id}`, { as: admin, method: 'DELETE' })
    expect(after.status).toBe(200)
  })

  it('không xếp mentor/admin vào team (vượt ô "trong khoá" của ma trận quyền)', async () => {
    const mentor = await makeUser('mentor')
    const res = await call(`/api/admin/teams/${teamId}/members`, { as: admin, body: { userId: mentor.id } })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('not_a_member_role')
  })

  it('mọi thành viên thấy trang team của mình; người ngoài thấy null', async () => {
    const mine = await call('/api/member/teams/mine', { as: teammate })
    expect(mine.body.data.id).toBe(teamId)
    expect(mine.body.data.isLeader).toBe(false)
    expect((await call('/api/member/teams/mine', { as: leader })).body.data.isLeader).toBe(true)
    expect((await call('/api/member/teams/mine', { as: outsider })).body.data).toBeNull()
  })

  it('chỉ LEADER xem được tiến độ và bài nộp của team', async () => {
    expect((await call(`/api/member/teams/${teamId}/progress`, { as: leader })).status).toBe(200)
    expect((await call(`/api/member/teams/${teamId}/submissions`, { as: leader })).status).toBe(200)
    expect((await call(`/api/member/teams/${teamId}/progress`, { as: teammate })).status).toBe(403)
    expect((await call(`/api/member/teams/${teamId}/submissions`, { as: teammate })).status).toBe(403)
  })

  it('IDOR: người ngoài team không chạm được endpoint của team đó', async () => {
    expect((await call(`/api/member/teams/${teamId}/progress`, { as: outsider })).status).toBe(403)
    expect((await call(`/api/member/teams/${teamId}/submissions`, { as: outsider })).status).toBe(403)
  })

  it('cây route của leader KHÔNG có mutation nào', async () => {
    for (const [path, method] of [
      [`/api/member/teams/${teamId}/progress`, 'POST'],
      [`/api/member/teams/${teamId}/submissions`, 'POST'],
      [`/api/member/teams/${teamId}`, 'PATCH'],
      [`/api/member/teams/${teamId}`, 'DELETE'],
    ] as const) {
      const res = await call(path, { as: leader, method, body: {} })
      expect(res.status, `${method} ${path}`).toBe(404)
    }
  })

  it('leader thấy source bài nộp thường, KHÔNG thấy source contest đang diễn ra', async () => {
    const mentor = await makeUser('mentor')
    const course = await makeCourse(mentor.id)
    await enroll(course.id, teammate.id)
    const problemId = await makeProblem(mentor.id)
    await addTestcases(problemId, [{ input: '1\n', expected: '1\n', kind: 'sample' }])
    const itemId = await makeItem(course.id, problemId)

    // Bài nộp thường trong khoá.
    await q(sql`
      INSERT INTO submissions (kind, user_id, problem_id, item_id, language_id, source, source_bytes,
                               status, verdict, passed_weight, total_weight, attempt)
      VALUES ('submit', ${teammate.id}, ${problemId}, ${itemId}, 'c11', 'SOURCE_KHOA_HOC', 15,
              'done', 'AC', 1, 1, 1)
    `)

    // Bài nộp trong contest CÒN ĐANG DIỄN RA.
    const [contest] = await q<{ id: string }>(sql`
      INSERT INTO contests (title, start_at, end_at, status)
      VALUES ('Tuần 36', now() - interval '1 hour', now() + interval '2 days', 'published') RETURNING id
    `)
    const [cp] = await q<{ id: string }>(sql`
      INSERT INTO contest_problems (contest_id, problem_id, position) VALUES (${contest!.id}, ${problemId}, 1)
      RETURNING id
    `)
    await q(sql`
      INSERT INTO submissions (kind, user_id, problem_id, contest_id, contest_problem_id, language_id,
                               source, source_bytes, status, verdict, passed_weight, total_weight, attempt)
      VALUES ('submit', ${teammate.id}, ${problemId}, ${contest!.id}, ${cp!.id}, 'c11',
              'SOURCE_CONTEST_DANG_DIEN_RA', 27, 'done', 'AC', 1, 1, 1)
    `)

    const res = await call(`/api/member/teams/${teamId}/submissions`, { as: leader })
    expect(res.status).toBe(200)
    const text = JSON.stringify(res.body)
    expect(text).toContain('SOURCE_KHOA_HOC')
    // Kênh chép bài trong contest bị chặn (design §14 Delta v0.7).
    expect(text).not.toContain('SOURCE_CONTEST_DANG_DIEN_RA')
    const contestRow = res.body.data.find((r: { source: string | null }) => r.source === null)
    expect(contestRow.sourceEmbargoedUntil).toBeTruthy()
  })

  it('leader không bao giờ thấy stdout/diff kể cả testcase mẫu (chặt hơn member)', async () => {
    const mentor = await makeUser('mentor')
    const problemId = await makeProblem(mentor.id)
    const [sub] = await q<{ id: string }>(sql`
      INSERT INTO submissions (kind, user_id, problem_id, language_id, source, source_bytes,
                               status, verdict, passed_weight, total_weight, attempt)
      VALUES ('submit', ${teammate.id}, ${problemId}, 'c11', 'x', 1, 'done', 'WA', 0, 1, 1)
      RETURNING id
    `)
    await q(sql`
      INSERT INTO submission_results (submission_id, attempt, position, is_sample, verdict, stdout, stderr)
      VALUES (${sub!.id}, 1, 1, true, 'WA', 'STDOUT_KHONG_DUOC_LO', 'STDERR_KHONG_DUOC_LO')
    `)
    const res = await call(`/api/member/teams/${teamId}/submissions`, { as: leader })
    const text = JSON.stringify(res.body)
    expect(text).not.toContain('STDOUT_KHONG_DUOC_LO')
    expect(text).not.toContain('STDERR_KHONG_DUOC_LO')
  })
})
