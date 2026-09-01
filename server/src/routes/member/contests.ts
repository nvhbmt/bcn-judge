/** FR-I1/I3/I4/I5/I6: member xem contest, đề mở đúng giờ, bảng xếp hạng. */
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { computeStandings, cutoffFor } from '../../contest/standings'
import { q } from '../../db/pool'
import { errors, ok } from '../../lib/apiResponse'
import { sseStream } from '../../realtime/sse'

export const memberContestRoutes = new Hono()

interface ContestRow {
  id: string
  title: string
  descriptionMd: string | null
  startAt: string
  endAt: string
  courseId: string | null
  freezeMinutes: number
  sequential: boolean
  inScope: boolean
  isStaff: boolean
}

/** Trạng thái DẪN XUẤT từ đồng hồ — không bao giờ lưu (FR-I1). */
function phaseOf(row: { startAt: string; endAt: string }, now = new Date()) {
  const start = new Date(row.startAt)
  const end = new Date(row.endAt)
  if (now < start) return 'sap-dien-ra' as const
  if (now < end) return 'dang-dien-ra' as const
  return 'da-ket-thuc' as const
}

async function loadContest(contestId: string, userId: string, role: string): Promise<ContestRow | null> {
  const [row] = await q<ContestRow>(sql`
    SELECT ct.id, ct.title, ct.description_md AS "descriptionMd",
           ct.start_at AS "startAt", ct.end_at AS "endAt", ct.course_id AS "courseId",
           ct.freeze_minutes AS "freezeMinutes", ct.sequential,
           (ct.course_id IS NULL OR EXISTS (
              SELECT 1 FROM course_enrollments ce
              WHERE ce.course_id = ct.course_id AND ce.user_id = ${userId} AND ce.status = 'active')) AS "inScope",
           (${role === 'admin'} OR EXISTS (
              SELECT 1 FROM course_mentors cm WHERE cm.course_id = ct.course_id AND cm.user_id = ${userId})) AS "isStaff"
    FROM contests ct
    WHERE ct.id = ${contestId} AND ct.deleted_at IS NULL
      AND (ct.status = 'published' OR ${role === 'admin'})
  `)
  return row ?? null
}

/** GET /api/member/contests — contest trong phạm vi của tôi (FR-B5). */
memberContestRoutes.get('/', async (c) => {
  const me = c.get('user')
  const rows = await q<{ id: string; title: string; startAt: string; endAt: string; problemCount: number }>(sql`
    SELECT ct.id, ct.title, ct.start_at AS "startAt", ct.end_at AS "endAt",
           (SELECT count(*)::int FROM contest_problems cp WHERE cp.contest_id = ct.id) AS "problemCount"
    FROM contests ct
    WHERE ct.status = 'published' AND ct.deleted_at IS NULL
      AND (ct.course_id IS NULL OR EXISTS (
            SELECT 1 FROM course_enrollments ce
            WHERE ce.course_id = ct.course_id AND ce.user_id = ${me.id} AND ce.status = 'active'))
    ORDER BY ct.start_at DESC LIMIT 50
  `)
  return ok(c, rows.map((r) => ({ ...r, phase: phaseOf(r) })))
})

/**
 * GET /api/member/contests/:id — trước giờ bắt đầu chỉ trả metadata + đếm ngược;
 * danh sách ĐỀ chỉ xuất hiện từ `start_at` (FR-I3, NFR-3: đề chưa mở là dữ liệu ẩn).
 */
memberContestRoutes.get('/:id', async (c) => {
  const me = c.get('user')
  const contest = await loadContest(c.req.param('id'), me.id, me.role)
  if (!contest || (!contest.inScope && !contest.isStaff)) return errors.notFound(c, 'Không tìm thấy contest.')

  const phase = phaseOf(contest)
  const revealed = phase !== 'sap-dien-ra' || contest.isStaff

  // Ghi nhận lượt mở đầu tiên — FR-I7 phân biệt "chưa từng mở" với "mở mà chưa nộp".
  await q(sql`
    INSERT INTO contest_participants (contest_id, user_id) VALUES (${contest.id}, ${me.id})
    ON CONFLICT DO NOTHING
  `)
  if (phase !== 'sap-dien-ra') {
    // Người phát sự kiện 'started' có tên: API chèn lười, idempotent (§2.5).
    await q(sql`
      INSERT INTO contest_events (contest_id, kind, payload)
      VALUES (${contest.id}, 'started', '{}'::jsonb) ON CONFLICT DO NOTHING
    `)
  }

  const problems = revealed
    ? await q<{ id: string; label: string | null; position: number; title: string; maxScore: number }>(sql`
        SELECT cp.id, cp.label, cp.position, p.title, cp.max_score AS "maxScore"
        FROM contest_problems cp JOIN problems p ON p.id = cp.problem_id
        WHERE cp.contest_id = ${contest.id} ORDER BY cp.position
      `)
    : []

  const [count] = await q<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM contest_problems WHERE contest_id = ${contest.id}
  `)

  return ok(
    c,
    {
      id: contest.id,
      title: contest.title,
      descriptionMd: contest.descriptionMd,
      startAt: contest.startAt,
      endAt: contest.endAt,
      phase,
      freezeMinutes: contest.freezeMinutes,
      problemCount: count?.n ?? 0,
      problems,
    },
    // Đồng hồ SERVER là thẩm quyền duy nhất cho đếm ngược (§4.3).
    { serverTime: new Date().toISOString() },
  )
})

/** GET /api/member/contests/:id/standings — FR-I5, đóng băng theo FR-I10. */
memberContestRoutes.get('/:id/standings', async (c) => {
  const me = c.get('user')
  const contest = await loadContest(c.req.param('id'), me.id, me.role)
  if (!contest || (!contest.inScope && !contest.isStaff)) return errors.notFound(c, 'Không tìm thấy contest.')

  const rows = await computeStandings(contest.id, {
    cutoff: cutoffFor({ endAt: new Date(contest.endAt), freezeMinutes: contest.freezeMinutes }, contest.isStaff),
    meId: me.id,
  })
  return ok(c, rows, {
    frozen: contest.freezeMinutes > 0 && phaseOf(contest) === 'dang-dien-ra' && !contest.isStaff,
    phase: phaseOf(contest),
  })
})

/** SSE cho contest: standings.changed + started (FR-F4/FR-I3). */
memberContestRoutes.get('/:id/events', async (c) => {
  const me = c.get('user')
  const contest = await loadContest(c.req.param('id'), me.id, me.role)
  if (!contest || (!contest.inScope && !contest.isStaff)) return errors.notFound(c, 'Không tìm thấy contest.')

  return sseStream(c, {
    channels: [`contest:${contest.id}`],
    replay: async (sinceSeq) =>
      (
        await q<{ seq: number; kind: string; payload: unknown }>(sql`
          SELECT seq, kind, payload FROM contest_events
          WHERE contest_id = ${contest.id} AND seq > ${sinceSeq} ORDER BY seq LIMIT 100
        `)
      ).map((r) => ({ seq: Number(r.seq), kind: r.kind, payload: r.payload })),
  })
})
