/** FR-F1/F2/F4, FR-G1: chạy thử, nộp bài, lịch sử của chính mình. */
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { q } from '../../db/pool'
import { enqueue } from '../../judge/queue'
import { created, errors, ok } from '../../lib/apiResponse'
import { parseBody } from '../../lib/http'
import { getSettings } from '../../lib/settings'
import { sseStream } from '../../realtime/sse'
import { toMemberProblem, type RawProblemRow, type RawTestcaseRow } from '../../serialize/problem'
import { toMemberSubmission, type RawResultRow, type RawSubmissionRow } from '../../serialize/submission'
import { resolveAccess } from './access'

export const memberSubmissionRoutes = new Hono()

const handleSchema = z.object({
  itemId: z.string().min(1).optional(),
  contestProblemId: z.string().min(1).optional(),
  languageId: z.string().min(1).max(40),
  source: z.string().max(2_000_000),
})

/**
 * Ngôn ngữ có nộp được cho bài này không.
 *
 * Với bài dạng function còn hai điều kiện nữa, và cả hai phải chặn TẠI ĐÂY chứ
 * không phải lúc chấm: thiếu thì worker ném ra IE, mà IE hiện lên như lỗi hệ
 * thống nên người học tưởng mình bị oan còn mentor không biết bài mình thiếu gì.
 *   - ngôn ngữ phải biết ghép hai file (`function_source_filename`)
 *   - bài phải có harness viết cho đúng ngôn ngữ đó
 */
async function languageAllowed(problemId: string, languageId: string): Promise<boolean> {
  const [row] = await q<{ allowed: boolean }>(sql`
    SELECT (
      l.enabled
      AND (p.allowed_language_ids IS NULL OR ${languageId} = ANY (p.allowed_language_ids))
      AND (
        p.kind <> 'function'
        OR (l.function_source_filename IS NOT NULL
            AND coalesce(btrim(p.harness ->> l.id), '') <> '')
      )
    ) AS allowed
    FROM problems p, languages l
    WHERE p.id = ${problemId} AND l.id = ${languageId}
  `)
  return row?.allowed === true
}

/** POST /api/member/submissions — nộp bài (chấm TOÀN BỘ testcase). */
memberSubmissionRoutes.post('/', async (c) => {
  const body = await parseBody(c, handleSchema)
  if (!body.ok) return body.response
  const me = c.get('user')

  const access = await resolveAccess(me, body.data)
  if (!access.ok) return errors_from(c, access)
  if (!(await languageAllowed(access.access.problemId, body.data.languageId))) {
    return errors.badRequest(c, 'Ngôn ngữ không được phép cho bài này.')
  }

  const result = await enqueue({
    kind: 'submit',
    userId: me.id,
    problemId: access.access.problemId,
    itemId: access.access.itemId,
    contestId: access.access.contestId,
    contestProblemId: access.access.contestProblemId,
    languageId: body.data.languageId,
    source: body.data.source,
  })
  if (!result.ok) {
    return result.code.endsWith('rate_limited') || result.code === 'pending_limit_exceeded'
      ? errors.tooMany(c, result.message, { code: result.code, retryAfterSec: result.retryAfterSec })
      : errors.badRequest(c, result.message, { code: result.code })
  }
  return created(c, { id: result.id, status: 'pending' })
})

/** POST /api/member/runs — chạy thử (testcase mẫu hoặc input tự nhập). */
memberSubmissionRoutes.post('/runs', async (c) => {
  const body = await parseBody(
    c,
    handleSchema.extend({
      target: z.enum(['samples', 'custom']).default('samples'),
      customInput: z.string().max(1_000_000).optional(),
    }),
  )
  if (!body.ok) return body.response
  const me = c.get('user')

  const access = await resolveAccess(me, body.data)
  if (!access.ok) return errors_from(c, access)
  if (!(await languageAllowed(access.access.problemId, body.data.languageId))) {
    return errors.badRequest(c, 'Ngôn ngữ không được phép cho bài này.')
  }

  const result = await enqueue({
    kind: 'run',
    userId: me.id,
    problemId: access.access.problemId,
    itemId: access.access.itemId,
    contestId: access.access.contestId,
    contestProblemId: access.access.contestProblemId,
    languageId: body.data.languageId,
    source: body.data.source,
    runTarget: body.data.target,
    customInput: body.data.customInput ? Buffer.from(body.data.customInput, 'utf8') : null,
  })
  if (!result.ok) {
    return result.code === 'run_rate_limited'
      ? errors.tooMany(c, result.message, { code: result.code })
      : errors.badRequest(c, result.message, { code: result.code })
  }
  return created(c, { id: result.id, status: 'pending' })
})

/** GET /api/member/submissions?itemId=… — lịch sử CỦA CHÍNH MÌNH (FR-G1). */
memberSubmissionRoutes.get('/', async (c) => {
  const me = c.get('user')
  const itemId = c.req.query('itemId')
  const contestProblemId = c.req.query('contestProblemId')
  if (!itemId && !contestProblemId) return errors.badRequest(c, 'Thiếu itemId hoặc contestProblemId.')

  const access = await resolveAccess(me, { itemId, contestProblemId })
  if (!access.ok) return errors_from(c, access)

  const rows = await q<RawSubmissionRow & { received_at: Date; finished_at: Date | null }>(sql`
    SELECT id, kind, user_id AS "userId", problem_id AS "problemId", item_id AS "itemId",
           contest_id AS "contestId", contest_problem_id AS "contestProblemId", language_id AS "languageId",
           source, source_bytes AS "sourceBytes", status, verdict, passed_weight AS "passedWeight",
           total_weight AS "totalWeight", time_ms_max AS "timeMsMax", memory_kb_max AS "memoryKbMax",
           compile_output AS "compileOutput", received_at, finished_at, queued_ms AS "queuedMs",
           judge_ms AS "judgeMs", attempt
    FROM submissions
    WHERE user_id = ${me.id} AND problem_id = ${access.access.problemId} AND kind = 'submit'
    ORDER BY seq DESC LIMIT 50
  `)
  return ok(
    c,
    rows.map((r) => toMemberSubmission({ ...r, receivedAt: r.received_at, finishedAt: r.finished_at })),
  )
})

/** GET /api/member/submissions/:id — chi tiết; CHỈ chủ sở hữu (chống IDOR §8). */
memberSubmissionRoutes.get('/:id', async (c) => {
  const me = c.get('user')
  const [row] = await q<RawSubmissionRow & { received_at: Date; finished_at: Date | null }>(sql`
    SELECT id, kind, user_id AS "userId", problem_id AS "problemId", item_id AS "itemId",
           contest_id AS "contestId", contest_problem_id AS "contestProblemId", language_id AS "languageId",
           source, source_bytes AS "sourceBytes", status, verdict, passed_weight AS "passedWeight",
           total_weight AS "totalWeight", time_ms_max AS "timeMsMax", memory_kb_max AS "memoryKbMax",
           compile_output AS "compileOutput", received_at, finished_at, queued_ms AS "queuedMs",
           judge_ms AS "judgeMs", attempt
    FROM submissions WHERE id = ${c.req.param('id')} AND user_id = ${me.id}
  `)
  if (!row) return errors.notFound(c, 'Không tìm thấy bài nộp.')

  const results = await q<RawResultRow>(sql`
    SELECT position, is_sample AS "isSample", verdict, time_ms AS "timeMs", memory_kb AS "memoryKb",
           exit_code AS "exitCode", term_signal AS "termSignal", detail, stdout, stderr,
           mentor_stdout AS "mentorStdout", first_diff_line AS "firstDiffLine"
    FROM submission_results WHERE submission_id = ${row.id} AND attempt = ${row.attempt}
    ORDER BY position
  `)
  return ok(
    c,
    toMemberSubmission({ ...row, receivedAt: row.received_at, finishedAt: row.finished_at }, results, {
      includeSource: true,
    }),
  )
})

/**
 * GET /api/member/submissions/:id/events — SSE verdict từng testcase (FR-F4).
 * Mất kết nối thì client tự nối lại; polling chính route GET ở trên là đường lùi.
 */
memberSubmissionRoutes.get('/:id/events', async (c) => {
  const me = c.get('user')
  const [row] = await q<{ id: string }>(sql`
    SELECT id FROM submissions WHERE id = ${c.req.param('id')} AND user_id = ${me.id}
  `)
  if (!row) return errors.notFound(c, 'Không tìm thấy bài nộp.')
  return sseStream(c, { channels: [`submission:${row.id}`] })
})

/** GET /api/member/problems?itemId=… — đề bài qua serializer member (NFR-2). */
export const memberProblemRoutes = new Hono()

memberProblemRoutes.get('/', async (c) => {
  const me = c.get('user')
  const access = await resolveAccess(me, {
    itemId: c.req.query('itemId'),
    contestProblemId: c.req.query('contestProblemId'),
  })
  if (!access.ok) return errors_from(c, access)

  const [problem] = await q<RawProblemRow>(sql`
    -- harness KHÔNG bao giờ đi tới member, nên đường này không lấy nó ra khỏi DB
    -- luôn. Serializer vẫn là cổng chặn (khai kiểu never), đây là lớp thứ hai:
    -- byte không được nạp thì không có gì để rò. Khác solution_source — cột đó
    -- phải lấy vì FR-D7 cho phép mở lời giải sau khi AC.
    SELECT id, title, kind, '{}'::jsonb AS harness,
           statement_md AS "statementMd", input_desc_md AS "inputDescMd",
           output_desc_md AS "outputDescMd", constraints_md AS "constraintsMd", examples,
           time_limit_ms AS "timeLimitMs", memory_limit_mb AS "memoryLimitMb", difficulty, tags,
           allowed_language_ids AS "allowedLanguageIds", compare_mode AS "compareMode",
           starter_code AS "starterCode", solution_language_id AS "solutionLanguageId",
           solution_source AS "solutionSource", solution_visibility AS "solutionVisibility",
           testcase_rev AS "testcaseRev"
    FROM problems WHERE id = ${access.access.problemId} AND deleted_at IS NULL
  `)
  if (!problem) return errors.notFound(c, 'Không tìm thấy bài tập.')

  const testcases = await q<RawTestcaseRow>(sql`
    SELECT id, position, kind, weight, input, expected FROM testcases
    WHERE problem_id = ${access.access.problemId} ORDER BY position
  `)
  const s = await getSettings()
  return ok(
    c,
    toMemberProblem(problem, testcases, {
      timeLimitMs: s.default_time_limit_ms,
      memoryLimitMb: s.default_memory_limit_mb,
    }),
    { contestEndAt: access.access.contestEndAt?.toISOString() ?? null },
  )
})

function errors_from(c: Parameters<typeof errors.notFound>[0], access: { status: number; code: string; message: string }) {
  if (access.status === 403) return errors.forbidden(c, access.message)
  return errors.notFound(c, access.message)
}
