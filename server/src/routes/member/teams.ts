/**
 * FR-J2/J3/J4/J6: trang team và các view của leader.
 *
 * Leader KHÔNG có một mutation nào lên dữ liệu chấm, tiến độ hay thành viên —
 * đó là sự VẮNG MẶT của bề mặt, không phải một câu if ai đó có thể quên (§8).
 * Ngoại lệ duy nhất là ghi chú FR-J6: nó chỉ TẠO dữ liệu mới của chính leader,
 * không sửa được gì đang có.
 */
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { teamRole } from '../../auth/middleware'
import { q } from '../../db/pool'
import { created, errors, ok } from '../../lib/apiResponse'
import { parseBody } from '../../lib/http'
import { iso } from '../../lib/time'
import { toLeaderSubmission, type RawSubmissionRow } from '../../serialize/submission'
import { bestSubmissions } from './syllabus'

export const memberTeamRoutes = new Hono()

/** GET /api/member/teams/mine — team của tôi + danh sách thành viên (FR-J4). */
memberTeamRoutes.get('/mine', async (c) => {
  const me = c.get('user')
  const [team] = await q<{
    id: string
    name: string
    descriptionMd: string | null
    leaderId: string
    createdAt: Date | string
  }>(sql`
    -- created_at cho dòng meta "lập 12.08.2026" ở màn team: một nhóm mới lập tuần
    -- trước và một nhóm đã chạy nửa năm đọc tiến độ khác hẳn nhau.
    SELECT t.id, t.name, t.description_md AS "descriptionMd", t.leader_id AS "leaderId",
           t.created_at AS "createdAt"
    FROM team_members tm JOIN teams t ON t.id = tm.team_id
    WHERE tm.user_id = ${me.id}
  `)
  if (!team) return ok(c, null)

  const members = await q(sql`
    SELECT u.id, u.display_name AS "displayName", (u.id = ${team.leaderId}) AS "isLeader"
    FROM team_members tm JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = ${team.id}
    ORDER BY (u.id = ${team.leaderId}) DESC, u.display_name
  `)
  return ok(c, { ...team, createdAt: iso(team.createdAt), isLeader: team.leaderId === me.id, members })
})

/**
 * GET /api/member/teams/standings — bảng xếp hạng các team trong CÙNG khoá.
 *
 * Đặt TRƯỚC `/:teamId/...`: `standings` là một đoạn đường dẫn, để sau thì có nguy cơ
 * bị nuốt thành một teamId — đúng lớp lỗi mà repo đã dính với `/moi` và `/:courseId`.
 *
 * Điểm tính bằng ĐÚNG công thức của BXH khoá (`bestSubmissions`): bài tốt nhất của
 * mỗi người ở mỗi mục, quy về thang 100. Dùng chung một định nghĩa để hai bảng trên
 * cùng một màn hình không nói hai con số khác nhau về cùng một người.
 *
 * Xếp theo SỐ BÀI AC trước, rồi tổng điểm — cùng thứ tự với BXH khoá và standings
 * contest (§2.7). Tổng chứ không phải trung bình: team đông hơn thì tổng cao hơn, nên
 * số thành viên được trả kèm để người đọc tự thấy điều đó thay vì bị giấu đi.
 *
 * Team KHÔNG gắn khoá nào thì xếp trong phạm vi TOÀN CLB (mọi mục đã xuất bản), và
 * `scope` nói rõ đang dùng phạm vi nào.
 */
memberTeamRoutes.get('/standings', async (c) => {
  const me = c.get('user')

  const [team] = await q<{ id: string; courseId: string | null }>(sql`
    SELECT t.id, t.course_id AS "courseId"
    FROM team_members tm JOIN teams t ON t.id = tm.team_id
    WHERE tm.user_id = ${me.id}
  `)

  const [course] = team?.courseId
    ? await q<{ id: string; code: string; name: string }>(sql`
        SELECT id, code, name FROM courses WHERE id = ${team.courseId}
      `)
    : []

  /* Hai phạm vi, và phạm vi nào đang dùng thì NÓI RA ở `scope` để giao diện ghi lên
     đầu bảng — hai bảng cùng tên "BXH các team" mà một bảng tính trong khoá, một bảng
     tính toàn CLB thì con số không so được với nhau, và không có gì trên màn hình nói
     điều đó.

     Vì sao vẫn phải có nhánh toàn CLB: `teams.course_id` có trong lược đồ nhưng API
     admin KHÔNG đặt được (routes/admin/teams.ts chỉ nhận name/description/leader), nên
     mọi team tạo qua app đều NULL. Chỉ làm nhánh theo khoá là tính năng chết ngay khi
     rời khỏi dữ liệu seed. */
  const rows = await q<{
    id: string
    name: string
    acCount: number
    totalPoints: string
    memberCount: number
  }>(sql`
    WITH best AS (${bestSubmissions(course?.id ?? null)})
    SELECT t.id, t.name,
           count(best.user_id) FILTER (WHERE best.verdict = 'AC')::int AS "acCount",
           COALESCE(sum(best.points), 0) AS "totalPoints",
           count(DISTINCT tm.user_id)::int AS "memberCount"
    FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    LEFT JOIN best ON best.user_id = tm.user_id
    WHERE ${course ? sql`t.course_id = ${course.id}` : sql`t.course_id IS NULL`}
    GROUP BY t.id, t.name
    ORDER BY "acCount" DESC, "totalPoints" DESC, t.name ASC
  `)

  return ok(c, {
    scope: course ? { kind: 'khoa', label: course.name } : { kind: 'clb', label: 'toàn câu lạc bộ' },
    rows: rows.map((r, i) => ({
      rank: i + 1,
      id: r.id,
      name: r.name,
      acCount: r.acCount,
      totalPoints: Math.round(Number(r.totalPoints)),
      memberCount: r.memberCount,
      isMine: r.id === team?.id,
    })),
  })
})

/** GET /api/member/teams/:id/progress — bảng tiến độ team (FR-J2, chỉ leader). */
memberTeamRoutes.get('/:teamId/progress', async (c) => {
  const me = c.get('user')
  const teamId = c.req.param('teamId')
  const role = await teamRole(me.id, teamId)
  if (!role) return errors.forbidden(c, 'Bạn không thuộc team này.')
  if (!role.isLeader) return errors.forbidden(c, 'Chỉ leader xem được tiến độ của cả team.')

  const rows = await q<{
    userId: string
    displayName: string
    courseId: string
    courseName: string
    acCount: number
    totalItems: number
    lastSubmittedAt: string | null
  }>(sql`
    SELECT u.id AS "userId", u.display_name AS "displayName",
           cr.id AS "courseId", cr.name AS "courseName",
           count(*) FILTER (WHERE best.verdict = 'AC')::int AS "acCount",
           (SELECT count(*)::int FROM items i2
            JOIN sections s2 ON s2.id = i2.section_id
            WHERE s2.course_id = cr.id AND i2.kind = 'problem' AND i2.status = 'published') AS "totalItems",
           max(best.received_at) AS "lastSubmittedAt"
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    JOIN course_enrollments ce ON ce.user_id = u.id AND ce.status = 'active'
    JOIN courses cr ON cr.id = ce.course_id AND cr.status = 'open'
    LEFT JOIN LATERAL (
      SELECT DISTINCT ON (s.item_id) s.item_id, s.verdict, s.received_at
      FROM submissions s
      JOIN items i ON i.id = s.item_id
      JOIN sections sec ON sec.id = i.section_id
      WHERE s.user_id = u.id AND sec.course_id = cr.id AND i.status = 'published'
        AND s.kind = 'submit' AND s.status = 'done' AND s.verdict NOT IN ('CE', 'IE')
      ORDER BY s.item_id, (s.verdict = 'AC') DESC, s.received_at ASC
    ) best ON true
    WHERE tm.team_id = ${teamId}
    GROUP BY u.id, u.display_name, cr.id, cr.name
    ORDER BY u.display_name, cr.name
  `)
  return ok(c, rows)
})

/**
 * GET /api/member/teams/:id/submissions — bài nộp của thành viên (FR-J3).
 * Chỉ `kind='submit'` (lượt chạy thử không phải lịch sử — FR-F1), và source của
 * bài thuộc contest ĐANG DIỄN RA bị hoãn tới sau giờ kết thúc (chống chép bài).
 */
memberTeamRoutes.get('/:teamId/submissions', async (c) => {
  const me = c.get('user')
  const teamId = c.req.param('teamId')
  const role = await teamRole(me.id, teamId)
  if (!role) return errors.forbidden(c, 'Bạn không thuộc team này.')
  if (!role.isLeader) return errors.forbidden(c, 'Chỉ leader xem được bài nộp của cả team.')

  const userId = c.req.query('userId')
  const rows = await q<
    RawSubmissionRow & {
      received_at: string
      finished_at: string | null
      contest_end_at: string | null
      problem_title: string | null
    }
  >(sql`
    SELECT s.id, s.kind, s.user_id AS "userId", s.problem_id AS "problemId", s.item_id AS "itemId",
           s.contest_id AS "contestId", s.contest_problem_id AS "contestProblemId",
           s.language_id AS "languageId", s.source, s.source_bytes AS "sourceBytes", s.status, s.verdict,
           s.passed_weight AS "passedWeight", s.total_weight AS "totalWeight", s.time_ms_max AS "timeMsMax",
           s.memory_kb_max AS "memoryKbMax", s.compile_output AS "compileOutput", s.received_at,
           s.finished_at, s.queued_ms AS "queuedMs", s.judge_ms AS "judgeMs", s.attempt,
           ct.end_at AS contest_end_at,
           -- Tên bài: danh sách chỉ có verdict + giờ thì leader không biết đang xem
           -- bài nào. LEFT JOIN vì bài xoá mềm vẫn còn bài nộp trỏ tới.
           p.title AS problem_title
    FROM submissions s
    JOIN team_members tm ON tm.user_id = s.user_id AND tm.team_id = ${teamId}
    LEFT JOIN problems p ON p.id = s.problem_id
    LEFT JOIN contests ct ON ct.id = s.contest_id
    WHERE s.kind = 'submit'
      ${userId ? sql`AND s.user_id = ${userId}` : sql``}
    ORDER BY s.seq DESC LIMIT 200
  `)

  return ok(
    c,
    rows.map((r) =>
      toLeaderSubmission(
        { ...r, receivedAt: r.received_at, finishedAt: r.finished_at },
        {
          contestEndsAt: r.contest_end_at ? new Date(r.contest_end_at) : null,
          problemTitle: r.problem_title,
        },
      ),
    ),
  )
})

// ── FR-J6: ghi chú nhắc nhở của leader ───────────────────────────────────────

/** POST /api/member/teams/:id/notes — leader nhắc một thành viên trong team mình. */
memberTeamRoutes.post('/:teamId/notes', async (c) => {
  const me = c.get('user')
  const teamId = c.req.param('teamId')
  const role = await teamRole(me.id, teamId)
  if (!role?.isLeader) return errors.forbidden(c, 'Chỉ leader để lại được ghi chú.')

  const body = await parseBody(
    c,
    z.object({ targetUserId: z.string().min(1), body: z.string().min(1).max(2000) }),
  )
  if (!body.ok) return body.response

  // Chỉ nhắc được người TRONG team của mình.
  const target = await teamRole(body.data.targetUserId, teamId)
  if (!target) return errors.notFound(c, 'Người này không thuộc team của bạn.')

  const [row] = await q<{ id: string }>(sql`
    INSERT INTO team_notes (team_id, author_id, target_user_id, body)
    VALUES (${teamId}, ${me.id}, ${body.data.targetUserId}, ${body.data.body})
    RETURNING id
  `)
  return created(c, row)
})

/** GET /api/member/notes — ghi chú gửi CHO TÔI (thông báo trong app). */
memberTeamRoutes.get('/notes/mine', async (c) => {
  const me = c.get('user')
  const rows = await q(sql`
    SELECT n.id, n.body, n.created_at AS "createdAt", n.read_at AS "readAt",
           u.display_name AS "authorName", t.name AS "teamName"
    FROM team_notes n
    JOIN users u ON u.id = n.author_id
    JOIN teams t ON t.id = n.team_id
    WHERE n.target_user_id = ${me.id}
    ORDER BY n.created_at DESC LIMIT 50
  `)
  return ok(c, rows)
})

memberTeamRoutes.post('/notes/:noteId/read', async (c) => {
  const me = c.get('user')
  const [row] = await q<{ id: string }>(sql`
    UPDATE team_notes SET read_at = now()
    WHERE id = ${c.req.param('noteId')} AND target_user_id = ${me.id} AND read_at IS NULL
    RETURNING id
  `)
  if (!row) return errors.notFound(c, 'Không tìm thấy ghi chú.')
  return ok(c, { ok: true })
})

/** GET /api/member/teams/:id/notes — leader xem lại ghi chú mình đã để. */
memberTeamRoutes.get('/:teamId/notes', async (c) => {
  const me = c.get('user')
  const role = await teamRole(me.id, c.req.param('teamId'))
  if (!role?.isLeader) return errors.forbidden(c, 'Chỉ leader xem được danh sách ghi chú của team.')
  const rows = await q(sql`
    SELECT n.id, n.body, n.created_at AS "createdAt", n.read_at AS "readAt",
           u.display_name AS "targetName", n.target_user_id AS "targetUserId"
    FROM team_notes n JOIN users u ON u.id = n.target_user_id
    WHERE n.team_id = ${c.req.param('teamId')}
    ORDER BY n.created_at DESC LIMIT 200
  `)
  return ok(c, rows)
})
