/** FR-J: team & leader — quyền, bất biến, và chặn kênh chép bài trong contest. */
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

  it('FR-J1: đổi được TÊN và MÔ TẢ team mà không mất thành viên', async () => {
    // Trước đây chỉ có tạo và xoá, nên sửa một lỗi chính tả trong tên là phải xoá team
    // rồi tạo lại — mất sạch team_members và cả leader. Phép canh ở đây là số thành
    // viên PHẢI y nguyên sau khi đổi tên.
    const res = await call(`/api/admin/teams/${teamId}`, {
      as: admin,
      method: 'PATCH',
      body: { name: 'Alpha đã đổi', descriptionMd: 'Mô tả mới' },
    })
    expect(res.status).toBe(200)

    const [row] = await q<{ name: string; description_md: string; n: number }>(sql`
      SELECT t.name, t.description_md,
             (SELECT count(*)::int FROM team_members tm WHERE tm.team_id = t.id) AS n
      FROM teams t WHERE t.id = ${teamId}
    `)
    expect(row!.name).toBe('Alpha đã đổi')
    expect(row!.description_md).toBe('Mô tả mới')
    expect(row!.n).toBeGreaterThan(0)
  })

  it('FR-J1: sửa từng phần — chỉ gửi tên thì mô tả cũ còn nguyên', async () => {
    await call(`/api/admin/teams/${teamId}`, { as: admin, method: 'PATCH', body: { descriptionMd: 'Giữ lại' } })
    await call(`/api/admin/teams/${teamId}`, { as: admin, method: 'PATCH', body: { name: 'Chỉ đổi tên' } })
    const [row] = await q<{ name: string; description_md: string }>(
      sql`SELECT name, description_md FROM teams WHERE id = ${teamId}`,
    )
    expect(row!.name).toBe('Chỉ đổi tên')
    expect(row!.description_md).toBe('Giữ lại')
  })

  it('FR-J1: member và leader KHÔNG sửa được team', async () => {
    for (const user of [leader, teammate]) {
      const res = await call(`/api/admin/teams/${teamId}`, { as: user, method: 'PATCH', body: { name: 'X' } })
      expect(res.status).toBe(403)
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

  it('thành viên có Discord thì kèm avatarUrl, không thì null (client lùi về chữ cái đầu)', async () => {
    await q(sql`UPDATE users SET discord_id = '123456789012345678', discord_avatar = 'a1b2c3' WHERE id = ${leader.id}`)
    const mine = await call('/api/member/teams/mine', { as: teammate })
    const anh = Object.fromEntries(
      mine.body.data.members.map((m: { id: string; avatarUrl: string | null }) => [m.id, m.avatarUrl]),
    )
    expect(anh[leader.id]).toBe('https://cdn.discordapp.com/avatars/123456789012345678/a1b2c3.png?size=64')
    expect(anh[teammate.id]).toBeNull()
    // Không rò id/hash thô — chỉ URL đã dựng.
    expect(mine.body.data.members[0]).not.toHaveProperty('discordId')
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

  it('FR-J6: leader nhắc được thành viên, thành viên thấy và đánh dấu đã đọc', async () => {
    const sent = await call(`/api/member/teams/${teamId}/notes`, {
      as: leader,
      body: { targetUserId: teammate.id, body: 'Tuần này còn 2 bài chưa AC nhé.' },
    })
    expect(sent.status).toBe(201)

    const mine = await call('/api/member/teams/notes/mine', { as: teammate })
    expect(mine.body.data).toHaveLength(1)
    expect(mine.body.data[0].body).toContain('chưa AC')
    expect(mine.body.data[0].readAt).toBeNull()

    const read = await call(`/api/member/teams/notes/${mine.body.data[0].id}/read`, { as: teammate, method: 'POST' })
    expect(read.status).toBe(200)
    expect((await call('/api/member/teams/notes/mine', { as: teammate })).body.data[0].readAt).not.toBeNull()
  })

  it('FR-J6: chỉ leader để lại được ghi chú, và chỉ cho người trong team', async () => {
    const notLeader = await call(`/api/member/teams/${teamId}/notes`, {
      as: teammate,
      body: { targetUserId: leader.id, body: 'x' },
    })
    expect(notLeader.status).toBe(403)

    const outsiderTarget = await call(`/api/member/teams/${teamId}/notes`, {
      as: leader,
      body: { targetUserId: outsider.id, body: 'x' },
    })
    expect(outsiderTarget.status).toBe(404)
  })

  it('FR-J6: admin đọc được ghi chú của team, mentor ngoài khoá thì không', async () => {
    // Vế cuối của FR-J6 — "mentor/admin xem được các ghi chú này". Trước đây điều
    // kiện chỉ có isLeader, mà admin không thuộc team nào nên teamRole trả null:
    // người chịu trách nhiệm về lời nhắc lại là người duy nhất không đọc được.
    await call(`/api/member/teams/${teamId}/notes`, {
      as: leader,
      body: { targetUserId: teammate.id, body: 'Tuần này nhớ nộp bài 3.' },
    })

    const cuaAdmin = await call(`/api/member/teams/${teamId}/notes`, { as: admin })
    expect(cuaAdmin.status).toBe(200)
    expect(cuaAdmin.body.data).toHaveLength(1)
    expect(cuaAdmin.body.data[0].body).toContain('bài 3')

    // Team này không gắn khoá nào ⇒ team toàn ban ⇒ mentor không có phạm vi để suy
    // ra quyền, phải bị chặn. Chỉ admin đọc được.
    const mentor = await makeUser('mentor')
    expect((await call(`/api/member/teams/${teamId}/notes`, { as: mentor })).status).toBe(403)
  })

  it('FR-J6: thành viên thường vẫn KHÔNG đọc được cả sổ ghi chú của team', async () => {
    await call(`/api/member/teams/${teamId}/notes`, {
      as: leader,
      body: { targetUserId: teammate.id, body: 'riêng tư' },
    })
    expect((await call(`/api/member/teams/${teamId}/notes`, { as: teammate })).status).toBe(403)
    expect((await call(`/api/member/teams/${teamId}/notes`, { as: outsider })).status).toBe(403)
  })

  it('FR-J6: không đọc trộm được ghi chú của người khác', async () => {
    const sent = await call(`/api/member/teams/${teamId}/notes`, {
      as: leader,
      body: { targetUserId: teammate.id, body: 'riêng tư' },
    })
    expect(JSON.stringify((await call('/api/member/teams/notes/mine', { as: outsider })).body.data)).not.toContain('riêng tư')
    const steal = await call(`/api/member/teams/notes/${sent.body.data.id}/read`, { as: outsider, method: 'POST' })
    expect(steal.status).toBe(404)
  })

  it('leader không có mutation nào lên dữ liệu chấm, tiến độ hay thành viên', async () => {
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

/**
 * GET /api/member/teams/standings — bảng xếp hạng các team.
 *
 * Hai phạm vi phải cùng chạy được. Nhánh TOÀN CLB không phải cho đẹp: `teams.course_id`
 * có trong lược đồ nhưng API admin không đặt được (chỉ nhận name/description/leader),
 * nên mọi team tạo qua app đều NULL — chỉ làm nhánh theo khoá là tính năng chết ngay
 * khi rời khỏi dữ liệu seed.
 */
describe.skipIf(!INTEGRATION)('BXH các team', () => {
  let admin: TestUser
  let a1: TestUser
  let b1: TestUser
  let ngoai: TestUser

  const lapTeam = async (name: string, leaderId: string) =>
    (await call('/api/admin/teams', { as: admin, body: { name, leaderId } })).body.data.id as string

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    admin = await makeUser('admin')
    a1 = await makeUser('member')
    b1 = await makeUser('member')
    ngoai = await makeUser('member')
  })

  it('xếp mọi team, đánh dấu team của mình', async () => {
    await lapTeam('Alpha', a1.id)
    await lapTeam('Beta', b1.id)

    const res = await call('/api/member/teams/standings', { as: a1 })
    expect(res.status).toBe(200)
    expect(res.body.data.map((r: { name: string }) => r.name).sort()).toEqual(['Alpha', 'Beta'])
    expect(res.body.data.find((r: { name: string }) => r.name === 'Alpha').isMine).toBe(true)
    expect(res.body.data.find((r: { name: string }) => r.name === 'Beta').isMine).toBe(false)
  })

  it('MỘT phạm vi duy nhất: mọi team đều có mặt, không lọc theo khoá của ai', async () => {
    // Bản trước chia hai nhánh (trong khoá của team / toàn CLB) và phải trả thêm nhãn
    // `scope` để giao diện nói đang dùng nhánh nào. Một bảng mà ý nghĩa con số đổi
    // theo hoàn cảnh thì người đọc phải kiểm nhãn trước mỗi lần nhìn.
    await lapTeam('Alpha', a1.id)
    await lapTeam('Beta', b1.id)
    const res = await call('/api/member/teams/standings', { as: ngoai })
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0].scope).toBeUndefined()
  })

  it('team chưa ai nộp bài vẫn có mặt với 0 điểm, không biến mất khỏi bảng', async () => {
    await lapTeam('Alpha', a1.id)
    const res = await call('/api/member/teams/standings', { as: a1 })
    const alpha = res.body.data[0]
    expect(alpha.acCount).toBe(0)
    expect(alpha.totalPoints).toBe(0)
    expect(alpha.memberCount).toBe(1)
  })

  it('người chưa thuộc team nào vẫn XEM được bảng, chỉ là không có dòng nào của mình', async () => {
    await lapTeam('Alpha', a1.id)
    const res = await call('/api/member/teams/standings', { as: ngoai })
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBe(1)
    expect(res.body.data.every((r: { isMine: boolean }) => !r.isMine)).toBe(true)
  })

  it('chưa đăng nhập thì không đọc được', async () => {
    expect((await call('/api/member/teams/standings')).status).toBe(401)
  })
})

/**
 * Danh sách team của admin trả kèm TÊN thành viên.
 *
 * Trước đây chỉ có `memberCount`, nên câu hỏi thường gặp nhất của admin — "ai đang ở
 * team nào" — phải mở lần lượt từng team mới trả lời được. Gộp vào một truy vấn thay
 * vì để trang gọi /:id/members cho từng team: 20 team là 20 lượt cho một màn chỉ để
 * liếc.
 */
describe.skipIf(!INTEGRATION)('danh sách team kèm thành viên', () => {
  let admin: TestUser
  let leader: TestUser
  let teammate: TestUser

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    admin = await makeUser('admin')
    leader = await makeUser('member')
    teammate = await makeUser('member')
  })

  it('trả tên từng người, leader đứng đầu và được đánh dấu', async () => {
    const t = await call('/api/admin/teams', { as: admin, body: { name: 'Alpha', leaderId: leader.id } })
    await call(`/api/admin/teams/${t.body.data.id}/members`, { as: admin, body: { userId: teammate.id } })

    const res = await call('/api/admin/teams', { as: admin })
    const team = res.body.data.find((x: { name: string }) => x.name === 'Alpha')
    expect(team.memberCount).toBe(2)
    expect(team.members).toHaveLength(2)
    expect(team.members[0].isLeader).toBe(true)
    expect(team.members[0].id).toBe(leader.id)
    expect(team.members.map((m: { id: string }) => m.id)).toContain(teammate.id)
  })

  it('team chỉ có leader vẫn trả MẢNG, không trả null', async () => {
    // json_agg trả NULL khi không có dòng nào; thiếu coalesce là client nổ khi .map.
    await call('/api/admin/teams', { as: admin, body: { name: 'Beta', leaderId: leader.id } })
    const res = await call('/api/admin/teams', { as: admin })
    const team = res.body.data.find((x: { name: string }) => x.name === 'Beta')
    expect(Array.isArray(team.members)).toBe(true)
    expect(team.members).toHaveLength(1)
  })
})
