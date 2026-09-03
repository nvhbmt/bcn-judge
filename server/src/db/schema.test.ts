/**
 * Bất biến ở TẦNG DB — guard API có bug thì cấu trúc vẫn chặn (§2.6, ADR-14).
 * Đây là lớp lưới thứ hai dưới ma trận quyền của permissions.test.ts.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { applyGrants, checkWorkerCannotTouchUsers } from './grants'
import { pool } from './pool'
import { INTEGRATION, makeUser, resetDb, setupDb } from '../testing/harness'

describe.skipIf(!INTEGRATION)('bất biến schema', () => {
  beforeAll(async () => {
    await setupDb()
  })
  beforeEach(async () => {
    await resetDb()
  })

  it('mỗi member thuộc tối đa MỘT team (FR-J1, unique ở DB)', async () => {
    const leader = await makeUser('member')
    const other = await makeUser('member')
    await createTeam('Alpha', leader.id)
    const t2 = await createTeam('Beta', other.id)

    await expect(
      pool.query('INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)', [t2, leader.id]),
    ).rejects.toThrow(/team_members_user_key/)
  })

  it('leader PHẢI là thành viên của chính team (ADR-14, composite FK deferred)', async () => {
    const leader = await makeUser('member')
    const outsider = await makeUser('member')
    const teamId = await createTeam('Gamma', leader.id)

    // Đổi leader sang người ngoài team → FK chặn ở commit.
    await expect(
      pool.query('UPDATE teams SET leader_id = $1 WHERE id = $2', [outsider.id, teamId]),
    ).rejects.toThrow(/teams_leader_is_member_fk/)
  })

  it('gỡ thành viên đang là leader bị FK chặn (phải đổi leader trước)', async () => {
    const leader = await makeUser('member')
    const teamId = await createTeam('Delta', leader.id)
    await expect(
      pool.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, leader.id]),
    ).rejects.toThrow(/teams_leader_is_member_fk/)
  })

  it('submission không thể trỏ contest problem A mà chấm bài B (§2.6)', async () => {
    const user = await makeUser('member')
    const p1 = await createProblem('Bài 1')
    const p2 = await createProblem('Bài 2')
    const contestId = await createContest()
    const { rows } = await pool.query<{ id: string }>(
      "INSERT INTO contest_problems (contest_id, problem_id, position) VALUES ($1, $2, 1) RETURNING id",
      [contestId, p1],
    )
    const cpId = rows[0]!.id

    await expect(
      pool.query(
        `INSERT INTO submissions (kind, user_id, problem_id, contest_id, contest_problem_id, language_id, source, source_bytes)
         VALUES ('submit', $1, $2, $3, $4, 'c11', 'x', 1)`,
        [user.id, p2, contestId, cpId], // cố tình lệch: contest problem của p1, chấm p2
      ),
    ).rejects.toThrow(/submissions_contest_problem_fk/)
  })

  it('submission_score_audit là append-only (trigger)', async () => {
    const user = await makeUser('member')
    const problemId = await createProblem('Bài audit')
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO submissions (kind, user_id, problem_id, language_id, source, source_bytes)
       VALUES ('submit', $1, $2, 'c11', 'x', 1) RETURNING id`,
      [user.id, problemId],
    )
    const submissionId = rows[0]!.id
    await pool.query(
      "INSERT INTO submission_score_audit (submission_id, reason) VALUES ($1, 'test')",
      [submissionId],
    )
    await expect(
      pool.query("UPDATE submission_score_audit SET reason = 'sửa' WHERE submission_id = $1", [submissionId]),
    ).rejects.toThrow(/append-only/)
  })

  it('tách quyền Postgres: worker KHÔNG chạm được bảng users (ADR-5)', async ({ skip }) => {
    const applied = await applyGrants(() => {})
    // `return` trần khiến test XANH mà không khẳng định gì, và không có dấu skip nào
    // để ai đó nhận ra. applyGrants trả false khi current_user không phải superuser —
    // đúng hình dạng của môi trường production/CI với role ứng dụng. Nghĩa là bất biến
    // an ninh ADR-5 báo PASS ở đúng nơi nó cần được kiểm nhất. Dùng skip() để trạng
    // thái "chưa kiểm" hiện ra thay vì giả dạng "đã đạt".
    if (!applied) skip('cần superuser để tạo role — chưa kiểm được ADR-5 ở môi trường này')
    const result = await checkWorkerCannotTouchUsers()
    expect(result.ok, result.detail).toBe(true)
  })
})

async function createTeam(name: string, leaderId: string): Promise<string> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ id: string }>(
      'INSERT INTO teams (name, leader_id) VALUES ($1, $2) RETURNING id',
      [name, leaderId],
    )
    const id = rows[0]!.id
    await client.query('INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)', [id, leaderId])
    await client.query('COMMIT')
    return id
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function createProblem(title: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    'INSERT INTO problems (title, statement_md) VALUES ($1, $2) RETURNING id',
    [title, 'đề'],
  )
  return rows[0]!.id
}

async function createContest(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO contests (title, start_at, end_at)
     VALUES ('Contest', now(), now() + interval '7 days') RETURNING id`,
  )
  return rows[0]!.id
}
