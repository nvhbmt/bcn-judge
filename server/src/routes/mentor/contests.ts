/** FR-I2/I7/I9: mentor tạo contest tuần, xuất bản, thống kê, nhân bản. */
import { sql } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { isCourseStaff } from '../../auth/middleware'
import { q, tx } from '../../db/pool'
import { created, errors, ok } from '../../lib/apiResponse'
import { audit } from '../../lib/audit'
import { parseBody } from '../../lib/http'

export const mentorContestRoutes = new Hono()

/** Contest toàn CLB (`course_id IS NULL`) chỉ admin đụng được (ma trận §3). */
async function canEdit(c: Context, contestId: string): Promise<boolean> {
  const me = c.get('user')
  const [row] = await q<{ courseId: string | null }>(sql`
    SELECT course_id AS "courseId" FROM contests WHERE id = ${contestId} AND deleted_at IS NULL
  `)
  if (!row) return false
  if (row.courseId === null) return me.role === 'admin'
  return isCourseStaff(me, row.courseId)
}

const contestSchema = z.object({
  title: z.string().min(1).max(200),
  descriptionMd: z.string().max(100_000).optional(),
  courseId: z.string().nullable().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  scoring: z.enum(['sum_score', 'icpc']).optional(),
  penaltyMinutes: z.number().int().min(0).max(120).optional(),
  sequential: z.boolean().optional(),
  freezeMinutes: z.number().int().min(0).max(600).optional(),
})

mentorContestRoutes.get('/', async (c) => {
  const me = c.get('user')
  const rows = await q(sql`
    SELECT ct.id, ct.title, ct.start_at AS "startAt", ct.end_at AS "endAt", ct.status,
           ct.course_id AS "courseId", ct.freeze_minutes AS "freezeMinutes",
           (SELECT count(*)::int FROM contest_problems cp WHERE cp.contest_id = ct.id) AS "problemCount"
    FROM contests ct
    WHERE ct.deleted_at IS NULL AND (
      ${me.role === 'admin'}
      OR EXISTS (SELECT 1 FROM course_mentors cm WHERE cm.course_id = ct.course_id AND cm.user_id = ${me.id})
    )
    ORDER BY ct.start_at DESC LIMIT 100
  `)
  return ok(c, rows)
})

mentorContestRoutes.post('/', async (c) => {
  const body = await parseBody(c, contestSchema)
  if (!body.ok) return body.response
  const me = c.get('user')
  const d = body.data

  if (d.courseId == null && me.role !== 'admin') {
    return errors.forbidden(c, 'Chỉ admin tạo được contest toàn câu lạc bộ.')
  }
  if (d.courseId && !(await isCourseStaff(me, d.courseId))) {
    return errors.notFound(c, 'Không tìm thấy khoá học.')
  }
  if (new Date(d.endAt) <= new Date(d.startAt)) {
    return errors.badRequest(c, 'Giờ kết thúc phải sau giờ bắt đầu.')
  }

  const [row] = await q<{ id: string }>(sql`
    INSERT INTO contests (title, description_md, course_id, start_at, end_at, scoring,
                          penalty_minutes, sequential, freeze_minutes, created_by)
    VALUES (${d.title}, ${d.descriptionMd ?? null}, ${d.courseId ?? null},
            ${d.startAt}::timestamptz, ${d.endAt}::timestamptz, ${d.scoring ?? 'sum_score'},
            ${d.penaltyMinutes ?? 20}, ${d.sequential ?? false}, ${d.freezeMinutes ?? 0}, ${me.id})
    RETURNING id
  `)
  await audit(me.id, 'contest.create', 'contest', row!.id, null, { title: d.title })
  return created(c, row)
})

mentorContestRoutes.patch('/:id', async (c) => {
  if (!(await canEdit(c, c.req.param('id')))) return errors.notFound(c, 'Không tìm thấy contest.')
  const body = await parseBody(c, contestSchema.partial().extend({ confirm: z.boolean().optional() }))
  if (!body.ok) return body.response
  const d = body.data

  await q(sql`
    UPDATE contests SET
      title = COALESCE(${d.title ?? null}, title),
      description_md = COALESCE(${d.descriptionMd ?? null}, description_md),
      start_at = COALESCE(${d.startAt ?? null}::timestamptz, start_at),
      end_at = COALESCE(${d.endAt ?? null}::timestamptz, end_at),
      scoring = COALESCE(${d.scoring ?? null}, scoring),
      penalty_minutes = COALESCE(${d.penaltyMinutes ?? null}, penalty_minutes),
      sequential = COALESCE(${d.sequential ?? null}, sequential),
      freeze_minutes = COALESCE(${d.freezeMinutes ?? null}, freeze_minutes),
      updated_at = now()
    WHERE id = ${c.req.param('id')}
  `)
  await audit(c.get('user').id, 'contest.update', 'contest', c.req.param('id'), null, d)
  return ok(c, { ok: true })
})

/** Xuất bản: cổng MỀM giống publish item (FR-D6 v0.5) + hai chặn cứng. */
mentorContestRoutes.post('/:id/publish', async (c) => {
  const contestId = c.req.param('id')
  if (!(await canEdit(c, contestId))) return errors.notFound(c, 'Không tìm thấy contest.')
  const body = await parseBody(c, z.object({ confirm: z.boolean().optional() }))
  if (!body.ok) return body.response

  const problems = await q<{
    title: string
    testcases: number
    missingExpected: number
    validated: boolean
  }>(sql`
    SELECT p.title,
           (SELECT count(*)::int FROM testcases t WHERE t.problem_id = p.id) AS testcases,
           (SELECT count(*)::int FROM testcases t WHERE t.problem_id = p.id AND t.expected IS NULL) AS "missingExpected",
           COALESCE(p.validated_testcase_rev = p.testcase_rev, false) AS validated
    FROM contest_problems cp JOIN problems p ON p.id = cp.problem_id
    WHERE cp.contest_id = ${contestId}
  `)

  if (problems.length === 0) return errors.conflict(c, 'no_problems', 'Contest chưa có bài nào.')
  const empty = problems.filter((p) => p.testcases === 0).map((p) => p.title)
  if (empty.length > 0) return errors.conflict(c, 'no_testcases', `Chưa có testcase: ${empty.join(', ')}.`)
  const missing = problems.filter((p) => p.missingExpected > 0).map((p) => p.title)
  if (missing.length > 0) return errors.conflict(c, 'missing_expected', `Còn testcase thiếu đáp án: ${missing.join(', ')}.`)

  const unvalidated = problems.filter((p) => !p.validated).map((p) => p.title)
  if (unvalidated.length > 0 && !body.data.confirm) {
    return errors.conflict(
      c,
      'publish_validation_failed',
      `Chưa kiểm bằng lời giải mẫu: ${unvalidated.join(', ')}. Xác nhận để xuất bản dù vậy.`,
      { problems: unvalidated },
    )
  }

  await q(sql`UPDATE contests SET status = 'published', updated_at = now() WHERE id = ${contestId}`)
  await audit(c.get('user').id, 'contest.publish', 'contest', contestId, null, { forced: unvalidated.length > 0 })
  return ok(c, { ok: true })
})

const problemsSchema = z.object({
  problems: z
    .array(z.object({ problemId: z.string(), label: z.string().max(4).optional(), maxScore: z.number().int().min(1).max(10_000).optional() }))
    .max(50),
})

/** Đặt danh sách bài + thứ tự + điểm tối đa (FR-I2). */
mentorContestRoutes.put('/:id/problems', async (c) => {
  const contestId = c.req.param('id')
  if (!(await canEdit(c, contestId))) return errors.notFound(c, 'Không tìm thấy contest.')
  const body = await parseBody(c, problemsSchema)
  if (!body.ok) return body.response

  await tx(async (t) => {
    // Bài đã có người nộp thì không được gỡ (composite FK của submissions giữ).
    await t.execute(sql`
      DELETE FROM contest_problems cp
      WHERE cp.contest_id = ${contestId}
        AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.contest_problem_id = cp.id)
    `)
    for (const [i, p] of body.data.problems.entries()) {
      await t.execute(sql`
        INSERT INTO contest_problems (contest_id, problem_id, position, label, max_score)
        VALUES (${contestId}, ${p.problemId}, ${i + 1},
                ${p.label ?? String.fromCharCode(65 + i)}, ${p.maxScore ?? 100})
        ON CONFLICT (contest_id, problem_id)
        DO UPDATE SET position = ${i + 1}, label = ${p.label ?? String.fromCharCode(65 + i)},
                      max_score = ${p.maxScore ?? 100}
      `)
    }
  })
  await audit(c.get('user').id, 'contest.problems', 'contest', contestId, null, { count: body.data.problems.length })
  return ok(c, { count: body.data.problems.length })
})

/** FR-I7: thống kê contest — ai tham gia, ai chưa nộp, phân bố verdict. */
mentorContestRoutes.get('/:id/stats', async (c) => {
  const contestId = c.req.param('id')
  if (!(await canEdit(c, contestId))) return errors.notFound(c, 'Không tìm thấy contest.')

  const [summary] = await q<{ opened: number; submitted: number }>(sql`
    SELECT (SELECT count(*)::int FROM contest_participants WHERE contest_id = ${contestId}) AS opened,
           (SELECT count(DISTINCT user_id)::int FROM submissions
            WHERE contest_id = ${contestId} AND kind = 'submit') AS submitted
  `)

  const byProblem = await q(sql`
    SELECT cp.id AS "contestProblemId", p.title, s.verdict, count(*)::int AS n
    FROM contest_problems cp
    JOIN problems p ON p.id = cp.problem_id
    LEFT JOIN submissions s ON s.contest_problem_id = cp.id AND s.kind = 'submit' AND s.status = 'done'
    WHERE cp.contest_id = ${contestId}
    GROUP BY cp.id, p.title, s.verdict
    ORDER BY cp.id
  `)

  const notSubmitted = await q(sql`
    SELECT u.id, u.display_name AS "displayName"
    FROM contest_participants cpar
    JOIN users u ON u.id = cpar.user_id
    WHERE cpar.contest_id = ${contestId}
      AND NOT EXISTS (SELECT 1 FROM submissions s
                      WHERE s.contest_id = ${contestId} AND s.user_id = u.id AND s.kind = 'submit')
    ORDER BY u.display_name
  `)

  return ok(c, { opened: summary?.opened ?? 0, submitted: summary?.submitted ?? 0, byProblem, notSubmitted })
})

/** FR-I9: nhân bản contest tuần trước — dời +7 ngày, DANH SÁCH BÀI ĐỂ TRỐNG (US-10). */
mentorContestRoutes.post('/:id/clone', async (c) => {
  const contestId = c.req.param('id')
  if (!(await canEdit(c, contestId))) return errors.notFound(c, 'Không tìm thấy contest.')

  const [row] = await q<{ id: string }>(sql`
    INSERT INTO contests (title, description_md, course_id, start_at, end_at, scoring,
                          penalty_minutes, sequential, freeze_minutes, status, created_by)
    SELECT title || ' (bản sao)', description_md, course_id,
           start_at + interval '7 days', end_at + interval '7 days',
           scoring, penalty_minutes, sequential, freeze_minutes, 'draft', ${c.get('user').id}
    FROM contests WHERE id = ${contestId}
    RETURNING id
  `)
  await audit(c.get('user').id, 'contest.clone', 'contest', row!.id, null, { from: contestId })
  return created(c, row)
})
