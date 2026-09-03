/**
 * Hàng đợi chấm bài = chính bảng `submissions` (ADR-6, §4.2).
 * Không broker, không service có trạng thái thứ hai: `FOR UPDATE SKIP LOCKED`
 * + advisory lock + LISTEN/NOTIFY.
 */
import { sql } from 'drizzle-orm'
import { db, pool, q, qt } from '../db/pool'
import { getSettings } from '../lib/settings'
import { signalJobReady } from './wake'

export type SubmissionKind = 'submit' | 'run'
export type RunTarget = 'samples' | 'custom' | 'validate'

export interface EnqueueRequest {
  kind: SubmissionKind
  userId: string
  problemId: string
  languageId: string
  source: string
  itemId?: string | null
  contestId?: string | null
  contestProblemId?: string | null
  customInput?: Buffer | null
  runTarget?: RunTarget | null
  testcaseRev?: number | null
}

export type EnqueueResult =
  | { ok: true; id: string; seq: number }
  | { ok: false; code: string; message: string; retryAfterSec?: number }

/** Khoá theo user để hai request song song không lách được giới hạn. */
const USER_LOCK = (userId: string) => sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`

export async function enqueue(req: EnqueueRequest): Promise<EnqueueResult> {
  const result = await enqueueInTx(req)
  // Rung chuông SAU khi commit, không phải trong transaction: trước commit thì worker
  // thức dậy và không thấy dòng nào — thành một nhịp poll bỏ phí đúng lúc cần nhanh.
  if (result.ok) void signalJobReady()
  return result
}

async function enqueueInTx(req: EnqueueRequest): Promise<EnqueueResult> {
  const s = await getSettings()
  if (s.judge_paused && req.kind === 'submit') {
    return { ok: false, code: 'judge_paused', message: 'Hệ thống chấm đang bảo trì, thử lại sau.' }
  }
  const sourceBytes = Buffer.byteLength(req.source, 'utf8')
  if (sourceBytes > s.max_source_bytes) {
    return {
      ok: false,
      code: 'source_too_large',
      message: `Source vượt ${Math.round(s.max_source_bytes / 1024)} KB.`,
    }
  }
  if (req.customInput && req.customInput.length > s.max_custom_input_bytes) {
    return {
      ok: false,
      code: 'input_too_large',
      message: `Input tự nhập vượt ${Math.round(s.max_custom_input_bytes / 1024)} KB.`,
    }
  }

  const perMinute = req.kind === 'submit' ? s.submissions_per_minute : s.runs_per_minute
  // Validate của mentor (FR-D6) đi cùng priority với submit nhưng không tính là
  // "chạy thử" của member: priority 1, kind 'run'.
  const priority = req.kind === 'run' && req.runTarget !== 'validate' ? 0 : 1

  return db.transaction(async (t) => {
    await t.execute(USER_LOCK(req.userId))

    const [recent] = await qt<{ n: number }>(t, sql`
      SELECT count(*)::int AS n FROM submissions
      WHERE user_id = ${req.userId} AND kind = ${req.kind}
        AND received_at > now() - interval '1 minute'
    `)
    if ((recent?.n ?? 0) >= perMinute) {
      return {
        ok: false as const,
        code: req.kind === 'submit' ? 'submit_rate_limited' : 'run_rate_limited',
        message: `Vượt ${perMinute} lượt mỗi phút. Thử lại sau ít giây.`,
        retryAfterSec: 60,
      }
    }

    // FR-F5 v0.5: tối đa 3 bài nộp PENDING mỗi người — không thì giờ đầu contest
    // một người xếp hàng không giới hạn và phá p95 của mọi người.
    if (req.kind === 'submit') {
      const [pending] = await qt<{ n: number }>(t, sql`
        SELECT count(*)::int AS n FROM submissions
        WHERE user_id = ${req.userId} AND kind = 'submit' AND status = 'pending'
      `)
      if ((pending?.n ?? 0) >= s.max_pending_submissions_per_user) {
        return {
          ok: false as const,
          code: 'pending_limit_exceeded',
          message: `Đang có ${pending?.n} bài chờ chấm. Đợi chấm xong rồi nộp tiếp.`,
        }
      }
    } else {
      // Lượt chạy thử mới THAY THẾ lượt đang chờ của chính mình (§4.2) — nhưng
      // KHÔNG đụng lượt validate: hai lần bấm "kiểm tra" mà lần đầu bị xoá thì nó
      // không bao giờ tới `done` và mentor chờ mãi (agent UI phát hiện).
      if (req.runTarget !== 'validate') {
        await t.execute(sql`
          DELETE FROM submissions
          WHERE user_id = ${req.userId} AND kind = 'run' AND status = 'pending'
            AND (run_target IS NULL OR run_target <> 'validate')
        `)
      }
    }

    const [row] = await qt<{ id: string; seq: number }>(t, sql`
      INSERT INTO submissions
        (kind, user_id, problem_id, item_id, contest_id, contest_problem_id, language_id,
         source, source_bytes, custom_input, run_target, priority, testcase_rev)
      VALUES
        (${req.kind}, ${req.userId}, ${req.problemId}, ${req.itemId ?? null}, ${req.contestId ?? null},
         ${req.contestProblemId ?? null}, ${req.languageId}, ${req.source}, ${sourceBytes},
         ${req.customInput ?? null}, ${req.runTarget ?? null}, ${priority}, ${req.testcaseRev ?? null})
      RETURNING id, seq
    `)
    return { ok: true as const, id: row!.id, seq: Number(row!.seq) }
  })
}

export interface ClaimedSubmission {
  id: string
  kind: SubmissionKind
  attempt: number
  userId: string
  problemId: string
  languageId: string
  source: string
  customInput: Buffer | null
  runTarget: RunTarget | null
  contestId: string | null
  queuedMs: number
}

/**
 * Nhận việc cho một slot (§4.2).
 *
 * Băng ưu tiên: slot 0 ưu tiên bài NỘP, slot khác ưu tiên chạy thử — nhưng khi
 * bài nộp chờ lâu nhất vượt 20 giây thì MỌI slot quay sang phục vụ bài nộp
 * (luật đảo băng, chống đói hai chiều; requirements FR-F6 v0.6 đã chuẩn nhận).
 * Một người tại một thời điểm chỉ có một việc đang chạy MỖI LOẠI, nên lượt chạy
 * thử 30 giây không chặn bài nộp contest của chính người đó.
 */
export async function claimNext(workerId: string, slot: number): Promise<ClaimedSubmission | null> {
  const [starving] = await q<{ starving: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM submissions
      WHERE status = 'pending' AND kind = 'submit'
        AND received_at < now() - interval '20 seconds'
    ) AS starving
  `)
  const preferSubmit = slot === 0 || starving?.starving === true
  const order = preferSubmit ? (['submit', 'run'] as const) : (['run', 'submit'] as const)

  for (const kind of order) {
    const claimed = await claimOfKind(workerId, kind)
    if (claimed) return claimed
  }
  return null
}

async function claimOfKind(workerId: string, kind: SubmissionKind): Promise<ClaimedSubmission | null> {
  const rows = await q<ClaimedSubmission & { queued_ms: number }>(sql`
    WITH candidate AS (
      SELECT s.id
      FROM submissions s
      WHERE s.status = 'pending'
        AND s.kind = ${kind}
        AND NOT EXISTS (
          SELECT 1 FROM submissions r
          WHERE r.user_id = s.user_id AND r.kind = s.kind AND r.status = 'running'
        )
      ORDER BY s.priority, s.seq
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE submissions s
    SET status = 'running',
        worker_id = ${workerId},
        attempt = s.attempt + 1,
        started_at = now(),
        heartbeat_at = now(),
        queued_ms = (EXTRACT(EPOCH FROM (now() - s.received_at)) * 1000)::int
    FROM candidate c
    WHERE s.id = c.id
    RETURNING s.id, s.kind, s.attempt, s.user_id AS "userId", s.problem_id AS "problemId",
              s.language_id AS "languageId", s.source, s.custom_input AS "customInput",
              s.run_target AS "runTarget", s.contest_id AS "contestId", s.queued_ms
  `)
  const row = rows[0]
  if (!row) return null
  return { ...row, queuedMs: Number(row.queued_ms) }
}

/** Nhịp tim 15 giây suốt vòng đời claim — kể cả GIỮA một testcase đang chạy (§3.2). */
export async function heartbeat(submissionId: string, workerId: string, attempt: number): Promise<boolean> {
  const rows = await q<{ id: string }>(sql`
    UPDATE submissions SET heartbeat_at = now()
    WHERE id = ${submissionId} AND worker_id = ${workerId} AND attempt = ${attempt} AND status = 'running'
    RETURNING id
  `)
  return rows.length > 0
}

export interface FinishPayload {
  verdict: string
  passedWeight: number
  totalWeight: number
  timeMsMax: number
  memoryKbMax: number
  compileOutput: string
  judgeMs: number
  ieReason: string | null
  testcaseRev: number | null
  results: {
    position: number
    testcaseId: string | null
    isSample: boolean
    verdict: string
    timeMs: number
    memoryKb: number
    exitCode: number | null
    termSignal: number | null
    detail: string | null
    stdout: string | null
    stderr: string | null
    mentorStdout: string | null
    firstDiffLine: number | null
  }[]
}

/**
 * Chốt hạ kết quả với FENCING: mọi câu ghi mang `worker_id AND attempt AND
 * status='running'`. Khớp 0 hàng ⇒ reaper đã thu hồi bài và giao cho attempt
 * khác — slot bỏ cuộc tại chỗ, KHÔNG BAO GIỜ ghi đè trạng thái của attempt mới.
 */
export async function finish(
  submissionId: string,
  workerId: string,
  attempt: number,
  payload: FinishPayload,
): Promise<boolean> {
  return db.transaction(async (t) => {
    const updated = await qt<{ id: string }>(t, sql`
      UPDATE submissions
      SET status = 'done', verdict = ${payload.verdict}, passed_weight = ${payload.passedWeight},
          total_weight = ${payload.totalWeight}, time_ms_max = ${payload.timeMsMax},
          memory_kb_max = ${payload.memoryKbMax}, compile_output = ${payload.compileOutput || null},
          judge_ms = ${payload.judgeMs}, ie_reason = ${payload.ieReason},
          testcase_rev = COALESCE(${payload.testcaseRev}, testcase_rev), finished_at = now()
      WHERE id = ${submissionId} AND worker_id = ${workerId} AND attempt = ${attempt} AND status = 'running'
      RETURNING id
    `)
    if (updated.length === 0) return false

    for (const r of payload.results) {
      await t.execute(sql`
        INSERT INTO submission_results
          (submission_id, attempt, position, testcase_id, is_sample, verdict, time_ms, memory_kb,
           exit_code, term_signal, detail, stdout, stderr, mentor_stdout, first_diff_line)
        VALUES
          (${submissionId}, ${attempt}, ${r.position}, ${r.testcaseId}, ${r.isSample}, ${r.verdict},
           ${r.timeMs}, ${r.memoryKb}, ${r.exitCode}, ${r.termSignal}, ${r.detail}, ${r.stdout},
           ${r.stderr}, ${r.mentorStdout}, ${r.firstDiffLine})
        ON CONFLICT (submission_id, attempt, position) DO NOTHING
      `)
    }
    return true
  })
}

/** Trả bài về hàng đợi khi worker tắt êm (SIGTERM) — không ăn attempt (§9). */
export async function requeue(submissionId: string, workerId: string, attempt: number): Promise<void> {
  await db.transaction(async (t) => {
    // Xoá kết quả của attempt dở: chấm lại từ testcase 1 nên chúng vô giá trị,
    // và giữ lại sẽ va PK khi attempt được cấp lại cùng số.
    await t.execute(sql`
      DELETE FROM submission_results WHERE submission_id = ${submissionId} AND attempt = ${attempt}
    `)
    await t.execute(sql`
      UPDATE submissions SET status = 'pending', worker_id = NULL, heartbeat_at = NULL,
                             attempt = attempt - 1, started_at = NULL
      WHERE id = ${submissionId} AND worker_id = ${workerId} AND attempt = ${attempt} AND status = 'running'
    `)
  })
}

/**
 * Reaper: thu hồi bài mà worker đã chết giữa chừng (§3.5).
 * Ngưỡng ĐỘNG: max(60 s, wall của testcase lớn nhất + 10 s) — bài Python T=21 s
 * có một testcase hợp lệ im lặng hơn 60 giây, ngưỡng cứng sẽ cướp bài oan.
 */
export async function reapStale(): Promise<{ requeued: number; failed: number }> {
  const requeued = await q<{ id: string }>(sql`
    UPDATE submissions s
    SET status = 'pending', worker_id = NULL, heartbeat_at = NULL, started_at = NULL
    WHERE s.status = 'running' AND s.attempt < 3
      AND s.heartbeat_at < now() - make_interval(secs => GREATEST(
            60,
            COALESCE((SELECT 2 * (COALESCE(p.time_limit_ms, 1000) / 1000.0) * COALESCE(l.time_factor, 1) + 12
                      FROM problems p, languages l
                      WHERE p.id = s.problem_id AND l.id = s.language_id), 60)))
    RETURNING s.id
  `)
  const failed = await q<{ id: string }>(sql`
    UPDATE submissions s
    SET status = 'done', verdict = 'IE', ie_reason = 'stale_heartbeat', ie_retry = true, finished_at = now()
    WHERE s.status = 'running' AND s.attempt >= 3
      AND s.heartbeat_at < now() - interval '120 seconds'
    RETURNING s.id
  `)
  return { requeued: requeued.length, failed: failed.length }
}

/** FR-F8: IE do sự cố hạ tầng được chấm lại khi judge sống lại. */
export async function retryIeSubmissions(withinHours = 24): Promise<number> {
  const rows = await q<{ id: string }>(sql`
    UPDATE submissions
    SET status = 'pending', verdict = NULL, ie_reason = NULL, worker_id = NULL,
        heartbeat_at = NULL, started_at = NULL, finished_at = NULL
    WHERE status = 'done' AND verdict = 'IE' AND ie_retry = true
      AND received_at > now() - make_interval(hours => ${withinHours})
    RETURNING id
  `)
  return rows.length
}

/** Vệ sinh mỗi giờ (§3): run cũ hơn 24 h, contest_events cũ hơn 7 ngày. */
export async function purgeOld(): Promise<{ runs: number; events: number }> {
  const runs = await q<{ id: string }>(sql`
    DELETE FROM submissions WHERE kind = 'run' AND received_at < now() - interval '24 hours' RETURNING id
  `)
  const events = await q<{ seq: number }>(sql`
    DELETE FROM contest_events WHERE created_at < now() - interval '7 days' RETURNING seq
  `)
  return { runs: runs.length, events: events.length }
}

export async function queueStats(): Promise<{
  pendingSubmit: number
  pendingRun: number
  running: number
  oldestPendingSubmitSec: number | null
}> {
  const [row] = await pool.query<{
    pending_submit: string
    pending_run: string
    running: string
    oldest: string | null
  }>(`
    SELECT
      count(*) FILTER (WHERE status='pending' AND kind='submit') AS pending_submit,
      count(*) FILTER (WHERE status='pending' AND kind='run')    AS pending_run,
      count(*) FILTER (WHERE status='running')                   AS running,
      EXTRACT(EPOCH FROM (now() - min(received_at) FILTER (WHERE status='pending' AND kind='submit'))) AS oldest
    FROM submissions
  `).then((r) => r.rows)
  return {
    pendingSubmit: Number(row?.pending_submit ?? 0),
    pendingRun: Number(row?.pending_run ?? 0),
    running: Number(row?.running ?? 0),
    oldestPendingSubmitSec: row?.oldest === null || row?.oldest === undefined ? null : Number(row.oldest),
  }
}

// ── Chấm lại (FR-D9, ADR-9, §2.6) ────────────────────────────────────────────

export interface RejudgeJob extends ClaimedSubmission {
  shadowAttempt: number
}

/** Mọi bài nộp của một bài tập — dùng khi mentor sửa testcase (FR-D9). */
export async function enqueueRejudgeForProblem(problemId: string, actorId: string, reason: string): Promise<number> {
  const rows = await q<{ submission_id: string }>(sql`
    INSERT INTO rejudge_queue (submission_id, actor, reason)
    SELECT id, ${actorId}, ${reason} FROM submissions
    WHERE problem_id = ${problemId} AND kind = 'submit' AND status = 'done'
    ON CONFLICT (submission_id) DO NOTHING
    RETURNING submission_id
  `)
  return rows.length
}

/**
 * Nhận một việc chấm lại — CHỈ khi cả hai băng run/submit đều trống (§2.6):
 * chấm lại là việc nền, không bao giờ được chen trước bài nộp của member.
 *
 * `shadow_attempt` cấp NGAY tại claim nên hai slot không bao giờ va PK
 * `(submission_id, attempt, position)`. Transaction ngắn — không giữ row lock
 * suốt lượt chấm, và KHÔNG delete-on-claim để worker chết còn nhặt lại được.
 */
export async function claimRejudge(workerId: string): Promise<RejudgeJob | null> {
  const [busy] = await q<{ busy: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM submissions WHERE status IN ('pending', 'running')) AS busy
  `)
  if (busy?.busy) return null

  const rows = await q<RejudgeJob & { shadow_attempt: number; queued_ms: number }>(sql`
    WITH candidate AS (
      SELECT rq.submission_id
      FROM rejudge_queue rq
      WHERE rq.claimed_by IS NULL
      ORDER BY rq.requested_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE rejudge_queue rq
    SET claimed_by = ${workerId}, claimed_at = now(),
        shadow_attempt = (SELECT max(attempt) + 1 FROM submissions s WHERE s.id = rq.submission_id)
    FROM candidate c
    JOIN submissions s ON s.id = c.submission_id
    WHERE rq.submission_id = c.submission_id
    RETURNING s.id, s.kind, s.user_id AS "userId", s.problem_id AS "problemId",
              s.language_id AS "languageId", s.source, s.custom_input AS "customInput",
              s.run_target AS "runTarget", s.contest_id AS "contestId",
              rq.shadow_attempt, 0 AS queued_ms
  `)
  const row = rows[0]
  if (!row) return null
  return { ...row, attempt: Number(row.shadow_attempt), shadowAttempt: Number(row.shadow_attempt), queuedMs: 0 }
}

/**
 * Chốt hạ một lượt chấm lại: ghi kết quả shadow, hoán đổi verdict/điểm và ghi
 * audit TRONG CÙNG MỘT transaction, rồi xoá dòng hàng đợi.
 *
 * Fencing dùng `rejudge_queue.claimed_by`, KHÔNG dùng predicate `status='running'`
 * của attempt thường — bài đang rejudge nằm ở `done`, áp predicate kia thì mọi
 * câu ghi khớp 0 hàng và chấm lại không bao giờ chạy được (§2.6 sửa vòng 2).
 */
export async function finishRejudge(
  submissionId: string,
  workerId: string,
  shadowAttempt: number,
  payload: FinishPayload,
): Promise<boolean> {
  return db.transaction(async (t) => {
    const claimed = await qt<{ submission_id: string }>(t, sql`
      SELECT submission_id FROM rejudge_queue
      WHERE submission_id = ${submissionId} AND claimed_by = ${workerId} AND shadow_attempt = ${shadowAttempt}
      FOR UPDATE
    `)
    if (claimed.length === 0) return false

    for (const r of payload.results) {
      await t.execute(sql`
        INSERT INTO submission_results
          (submission_id, attempt, position, testcase_id, is_sample, verdict, time_ms, memory_kb,
           exit_code, term_signal, detail, stdout, stderr, mentor_stdout, first_diff_line)
        VALUES
          (${submissionId}, ${shadowAttempt}, ${r.position}, ${r.testcaseId}, ${r.isSample}, ${r.verdict},
           ${r.timeMs}, ${r.memoryKb}, ${r.exitCode}, ${r.termSignal}, ${r.detail}, ${r.stdout},
           ${r.stderr}, ${r.mentorStdout}, ${r.firstDiffLine})
        ON CONFLICT (submission_id, attempt, position) DO NOTHING
      `)
    }

    // Kết quả TRƯỚC rejudge tồn tại vĩnh viễn nhờ `attempt` nằm trong PK (FR-D9).
    const [before] = await qt<{ verdict: string | null; passed_weight: number | null }>(t, sql`
      SELECT verdict, passed_weight FROM submissions WHERE id = ${submissionId}
    `)

    await t.execute(sql`
      UPDATE submissions
      SET verdict = ${payload.verdict}, passed_weight = ${payload.passedWeight},
          total_weight = ${payload.totalWeight}, time_ms_max = ${payload.timeMsMax},
          memory_kb_max = ${payload.memoryKbMax}, compile_output = ${payload.compileOutput || null},
          judge_ms = ${payload.judgeMs}, testcase_rev = ${payload.testcaseRev},
          attempt = ${shadowAttempt}, finished_at = now(),
          -- Xoá dấu vết IE của lượt TRƯỚC. Bỏ sót hai cột này thì một bài IE được
          -- chấm lại thành AC vẫn mang ie_reason cũ, và ie_retry vẫn bật nên nút
          -- "chấm lại IE" của admin còn nhặt nó lên lần nữa — một bài đã xong hẳn.
          -- (Không dùng dấu backtick trong chú thích SQL: nó nằm trong template
          --  literal của JS nên backtick sẽ kết thúc chuỗi giữa chừng.)
          ie_reason = NULL, ie_retry = false
      WHERE id = ${submissionId}
    `)

    await t.execute(sql`
      INSERT INTO submission_score_audit
        (submission_id, verdict_before, verdict_after, passed_weight_before, passed_weight_after, reason, actor)
      SELECT ${submissionId}, ${before?.verdict ?? null}, ${payload.verdict},
             ${before?.passed_weight ?? null}, ${payload.passedWeight},
             COALESCE(rq.reason, 'rejudge'), rq.actor
      FROM rejudge_queue rq WHERE rq.submission_id = ${submissionId}
    `)

    await t.execute(sql`DELETE FROM rejudge_queue WHERE submission_id = ${submissionId}`)
    return true
  })
}

/**
 * Nhả claim của CHÍNH worker này khi việc chấm lại ném lỗi.
 *
 * Đường lỗi trước gọi `reapRejudge()` với ý "nhả claim cho lượt sau nhặt lại", nhưng
 * reaper đòi claim phải cũ hơn 5 phút VÀ worker giữ nó phải mất tích 60 giây — worker
 * vừa claim xong và đang đập nhịp thì cả hai điều kiện đều sai, nên nó nhả được 0 việc.
 * `claimRejudge` chỉ nhặt dòng `claimed_by IS NULL`, nên dòng đó nằm lại vĩnh viễn và
 * verdict sai đứng nguyên, không tín hiệu nào ngoài `rejudgeQueueDepth()` khác 0.
 *
 * (Lỗi này từng tự khỏi một cách tình cờ: khi `last_seen_at` còn đứng yên vì nhịp tim
 * hỏng, worker "trông như đã chết" sau 60 giây nên reaper vẫn nhả được. Sửa nhịp tim
 * đã bịt mất lối thoát đó — đây là cái giá phải trả kèm, nay trả nốt.)
 *
 * Vẫn fencing theo `claimed_by` để một worker không nhả claim của worker khác.
 */
export async function releaseRejudge(submissionId: string, workerId: string): Promise<boolean> {
  const rows = await q<{ submission_id: string }>(sql`
    UPDATE rejudge_queue
    SET claimed_by = NULL, claimed_at = NULL, shadow_attempt = NULL
    WHERE submission_id = ${submissionId} AND claimed_by = ${workerId}
    RETURNING submission_id
  `)
  return rows.length > 0
}

/** Nhả claim của worker đã CHẾT THẬT — chấm lại không biến mất không dấu vết (§2.6). */
export async function reapRejudge(): Promise<number> {
  const rows = await q<{ submission_id: string }>(sql`
    UPDATE rejudge_queue rq
    SET claimed_by = NULL, claimed_at = NULL, shadow_attempt = NULL
    WHERE rq.claimed_by IS NOT NULL
      AND rq.claimed_at < now() - interval '5 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM workers w
        WHERE w.id = rq.claimed_by AND w.last_seen_at > now() - interval '60 seconds'
      )
    RETURNING submission_id
  `)
  return rows.length
}

export async function rejudgeQueueDepth(): Promise<number> {
  const [row] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM rejudge_queue`)
  return row?.n ?? 0
}
