/**
 * FR-J1: admin quản lý team và leader.
 *
 * Hai bất biến do DB giữ (ADR-14), API chỉ dịch lỗi FK sang thông điệp tiếng Việt:
 *   · mỗi member ≤ 1 team  → unique (user_id) trên team_members
 *   · leader ∈ team        → composite FK deferrable teams(id, leader_id)
 */
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { q, qt, tx } from '../../db/pool'
import { created, errors, ok } from '../../lib/apiResponse'
import { audit } from '../../lib/audit'
import { describeDbError } from '../../lib/dbError'
import { parseBody } from '../../lib/http'

export const adminTeamRoutes = new Hono()

adminTeamRoutes.get('/', async (c) => {
  const rows = await q(sql`
    SELECT t.id, t.name, t.description_md AS "descriptionMd", t.leader_id AS "leaderId",
           u.display_name AS "leaderName",
           (SELECT count(*)::int FROM team_members tm WHERE tm.team_id = t.id) AS "memberCount",
           -- Tên thành viên gộp luôn vào đây thay vì để trang gọi /:id/members cho
           -- TỪNG team: danh sách team là chỗ admin nhìn để biết ai đang ở đâu, mà
           -- 20 team là 20 lượt gọi cho một màn chỉ để liếc. Bọc coalesce vì team vừa
           -- tạo chưa có dòng nào và json_agg trả NULL chứ không phải mảng rỗng.
           -- (Chú thích trong khối SQL này KHÔNG được chứa dấu backtick: nó nằm trong
           --  template literal của JS, một dấu là chuỗi đứt ngay tại đó.)
           coalesce(
             (SELECT json_agg(
                       json_build_object(
                         'id', mu.id,
                         'displayName', mu.display_name,
                         'isLeader', mu.id = t.leader_id
                       )
                       ORDER BY (mu.id = t.leader_id) DESC, mu.display_name
                     )
              FROM team_members mtm JOIN users mu ON mu.id = mtm.user_id
              WHERE mtm.team_id = t.id),
             '[]'::json
           ) AS members
    FROM teams t JOIN users u ON u.id = t.leader_id
    ORDER BY t.name
  `)
  return ok(c, rows)
})

/** Danh sách thành viên — thiếu endpoint này thì admin không thấy ai đang ở team nào. */
adminTeamRoutes.get('/:id/members', async (c) => {
  const rows = await q(sql`
    SELECT u.id, u.email, u.display_name AS "displayName",
           (u.id = t.leader_id) AS "isLeader", tm.added_at AS "addedAt"
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.team_id = ${c.req.param('id')}
    ORDER BY (u.id = t.leader_id) DESC, u.display_name
  `)
  return ok(c, rows)
})

const teamSchema = z.object({
  name: z.string().min(1).max(120),
  descriptionMd: z.string().max(20_000).optional(),
  leaderId: z.string().min(1),
})

/** Tạo team + dòng thành viên của leader trong MỘT transaction (FK deferred). */
adminTeamRoutes.post('/', async (c) => {
  const body = await parseBody(c, teamSchema)
  if (!body.ok) return body.response
  const me = c.get('user')

  const [leader] = await q<{ role: string }>(sql`SELECT role FROM users WHERE id = ${body.data.leaderId}`)
  if (!leader) return errors.notFound(c, 'Không tìm thấy tài khoản leader.')
  if (leader.role !== 'member') {
    return errors.conflict(c, 'not_a_member_role', 'Chỉ tài khoản member mới vào được team.')
  }

  try {
    const id = await tx(async (t) => {
      const [row] = await qt<{ id: string }>(t, sql`
        INSERT INTO teams (name, description_md, leader_id, created_by)
        VALUES (${body.data.name}, ${body.data.descriptionMd ?? null}, ${body.data.leaderId}, ${me.id})
        RETURNING id
      `)
      await t.execute(sql`
        INSERT INTO team_members (team_id, user_id, added_by) VALUES (${row!.id}, ${body.data.leaderId}, ${me.id})
      `)
      return row!.id
    })
    await audit(me.id, 'team.create', 'team', id, null, { name: body.data.name })
    return created(c, { id })
  } catch (err) {
    return translateTeamError(c, err)
  }
})

adminTeamRoutes.post('/:id/members', async (c) => {
  const body = await parseBody(c, z.object({ userId: z.string().min(1) }))
  if (!body.ok) return body.response
  const me = c.get('user')

  const [user] = await q<{ role: string }>(sql`SELECT role FROM users WHERE id = ${body.data.userId}`)
  if (!user) return errors.notFound(c, 'Không tìm thấy tài khoản.')
  if (user.role !== 'member') {
    return errors.conflict(c, 'not_a_member_role', 'Chỉ tài khoản member mới vào được team.')
  }

  try {
    await q(sql`
      INSERT INTO team_members (team_id, user_id, added_by)
      VALUES (${c.req.param('id')}, ${body.data.userId}, ${me.id})
    `)
  } catch (err) {
    return translateTeamError(c, err)
  }
  await audit(me.id, 'team.member.add', 'team', c.req.param('id'), null, { userId: body.data.userId })
  return ok(c, { ok: true })
})

adminTeamRoutes.delete('/:id/members/:userId', async (c) => {
  try {
    await q(sql`
      DELETE FROM team_members WHERE team_id = ${c.req.param('id')} AND user_id = ${c.req.param('userId')}
    `)
  } catch (err) {
    return translateTeamError(c, err)
  }
  await audit(c.get('user').id, 'team.member.remove', 'team', c.req.param('id'), null, {
    userId: c.req.param('userId'),
  })
  return ok(c, { ok: true })
})

/** Đổi leader — một UPDATE; commit fail nếu người mới chưa là thành viên. */
adminTeamRoutes.put('/:id/leader', async (c) => {
  const body = await parseBody(c, z.object({ userId: z.string().min(1) }))
  if (!body.ok) return body.response
  try {
    const [row] = await q<{ id: string }>(sql`
      UPDATE teams SET leader_id = ${body.data.userId}, updated_at = now()
      WHERE id = ${c.req.param('id')} RETURNING id
    `)
    if (!row) return errors.notFound(c, 'Không tìm thấy team.')
  } catch (err) {
    return translateTeamError(c, err)
  }
  await audit(c.get('user').id, 'team.leader.change', 'team', c.req.param('id'), null, { userId: body.data.userId })
  return ok(c, { ok: true })
})

adminTeamRoutes.delete('/:id', async (c) => {
  const [row] = await q<{ id: string }>(sql`DELETE FROM teams WHERE id = ${c.req.param('id')} RETURNING id`)
  if (!row) return errors.notFound(c, 'Không tìm thấy team.')
  await audit(c.get('user').id, 'team.delete', 'team', c.req.param('id'), null, null)
  return ok(c, { ok: true })
})

function translateTeamError(c: Parameters<typeof errors.conflict>[0], err: unknown) {
  const message = describeDbError(err)
  if (message.includes('team_members_user_key')) {
    return errors.conflict(c, 'already_in_team', 'Thành viên này đã thuộc một team khác.')
  }
  if (message.includes('teams_leader_is_member_fk')) {
    return errors.conflict(c, 'leader_must_be_member', 'Leader phải là thành viên của chính team đó — đổi leader trước.')
  }
  throw err
}
