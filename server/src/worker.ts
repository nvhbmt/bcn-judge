/**
 * Judge worker (design.md §3, §4.2) — entrypoint thứ hai của cùng image server.
 *
 *   claim (SKIP LOCKED) → nạp bài + testcase → judgeSubmission (Docker) → chốt hạ
 *
 * Chạy `WORKER_SLOTS` slot song song; mỗi slot sở hữu tối đa một container.
 */
import { sql } from 'drizzle-orm'
import { hostname } from 'node:os'
import { config } from './config'
import { closePool, db, q } from './db/pool'
import type { LanguageConfig } from './judge/languages'
import {
  claimNext,
  finish,
  heartbeat,
  purgeOld,
  reapStale,
  requeue,
  type ClaimedSubmission,
} from './judge/queue'
import { judgeSubmission } from './judge/runner'
import { reapOrphanSandboxes } from './judge/sandbox'
import { DEFAULT_LIMITS, type JudgeLimits, type TestcaseInput } from './judge/types'
import { getSettings } from './lib/settings'

const WORKER_ID = `${hostname()}-${process.pid}`
const HEARTBEAT_MS = 15_000
const IDLE_POLL_MS = 1_000

let stopping = false

/** Sự kiện realtime: bus có thể chưa chạy — SSE tự hạ xuống polling (§4.3). */
async function emit(channel: string, payload: object): Promise<void> {
  try {
    const { publish } = await import('./realtime/bus')
    await publish(channel, payload)
  } catch {
    /* không chặn việc chấm */
  }
}

interface LanguageRow {
  id: string
  name: string
  image: string
  source_filename: string
  compile_argv: string[] | null
  run_argv: string[]
  time_factor: string
  memory_extra_mb: number
  enabled: boolean
}

function toLanguageConfig(row: LanguageRow, limits: JudgeLimits): LanguageConfig {
  const substitute = (arg: string) =>
    arg
      .replace('{memory_mb}', String(limits.memoryLimitMb))
      .replace('{time_s}', String(Math.ceil((limits.timeLimitMs * Number(row.time_factor)) / 1000)))
  return {
    id: row.id,
    label: row.name,
    image: row.image,
    sourceFilename: row.source_filename,
    compileArgv: row.compile_argv?.map(substitute) ?? null,
    runArgv: row.run_argv.map(substitute),
    timeFactor: Number(row.time_factor),
    memoryExtraMb: row.memory_extra_mb,
    enabled: row.enabled,
  }
}

interface JobContext {
  language: LanguageConfig
  limits: JudgeLimits
  testcases: TestcaseInput[]
  testcaseRev: number | null
  source: string
}

/** Nạp mọi thứ cần để chấm. Lỗi ở đây là IE — không bao giờ tính lên đầu member. */
async function loadJob(job: ClaimedSubmission): Promise<JobContext> {
  const s = await getSettings()

  const [problem] = await q<{
    time_limit_ms: number | null
    memory_limit_mb: number | null
    compare_mode: 'trim' | 'exact' | 'float'
    float_eps: number | null
    testcase_rev: number
    solution_source: string | null
  }>(sql`
    SELECT time_limit_ms, memory_limit_mb, compare_mode, float_eps, testcase_rev, solution_source
    FROM problems WHERE id = ${job.problemId}
  `)
  if (!problem) throw new Error('problem_not_found')

  const [langRow] = await q<LanguageRow>(sql`
    SELECT id, name, image, source_filename, compile_argv, run_argv, time_factor, memory_extra_mb, enabled
    FROM languages WHERE id = ${job.languageId}
  `)
  if (!langRow) throw new Error('language_not_found')

  const limits: JudgeLimits = {
    ...DEFAULT_LIMITS,
    timeLimitMs: problem.time_limit_ms ?? s.default_time_limit_ms,
    memoryLimitMb: problem.memory_limit_mb ?? s.default_memory_limit_mb,
    maxOutputBytes: s.max_output_bytes,
    compileTimeLimitMs: s.compile_time_limit_ms,
    compileMemoryMb: s.compile_memory_mb,
    compareMode: problem.compare_mode,
    ...(problem.float_eps !== null ? { floatEps: problem.float_eps } : {}),
  }

  // Chạy thử với input tự nhập: một testcase tổng hợp, không có expected.
  if (job.kind === 'run' && job.runTarget === 'custom') {
    return {
      language: toLanguageConfig(langRow, limits),
      limits,
      testcaseRev: problem.testcase_rev,
      source: job.source,
      testcases: [
        { position: 1, isSample: true, weight: 1, input: job.customInput ?? Buffer.alloc(0), expected: null },
      ],
    }
  }

  // 'samples' chỉ chấm testcase mẫu; 'validate' và submit chấm TOÀN BỘ.
  const onlySamples = job.kind === 'run' && job.runTarget === 'samples'
  const rows = await q<{
    id: string
    position: number
    kind: string
    weight: number
    input: Buffer
    expected: Buffer | null
  }>(sql`
    SELECT id, position, kind, weight, input, expected FROM testcases
    WHERE problem_id = ${job.problemId} ${onlySamples ? sql`AND kind = 'sample'` : sql``}
    ORDER BY position
  `)

  return {
    language: toLanguageConfig(langRow, limits),
    limits,
    testcaseRev: problem.testcase_rev,
    // FR-D6: validate chấm chính LỜI GIẢI MẪU của bài, không phải source người gửi.
    source: job.runTarget === 'validate' ? (problem.solution_source ?? job.source) : job.source,
    testcases: rows.map((r) => ({
      position: r.position,
      isSample: r.kind === 'sample',
      weight: r.weight,
      input: r.input,
      expected: r.expected,
    })),
  }
}

async function runJob(job: ClaimedSubmission, slot: number): Promise<void> {
  const beat = setInterval(() => {
    void heartbeat(job.id, WORKER_ID, job.attempt)
  }, HEARTBEAT_MS)

  try {
    const ctx = await loadJob(job)
    await emit(`submission:${job.id}`, { id: job.id, status: 'running' })

    if (ctx.testcases.length === 0) {
      await finish(job.id, WORKER_ID, job.attempt, {
        verdict: 'IE',
        passedWeight: 0,
        totalWeight: 0,
        timeMsMax: 0,
        memoryKbMax: 0,
        compileOutput: '',
        judgeMs: 0,
        ieReason: 'no_testcases',
        testcaseRev: ctx.testcaseRev,
        results: [],
      })
      return
    }

    const outcome = await judgeSubmission(
      {
        language: ctx.language,
        source: ctx.source,
        testcases: ctx.testcases,
        limits: ctx.limits,
        ...(config.workerCpuset ? { cpusetCpus: config.workerCpuset.split(',')[slot] ?? '' } : {}),
        labels: { 'bcnjudge.submission': job.id, 'bcnjudge.worker': WORKER_ID },
      },
      {
        onTestcase: (r) => {
          // FR-F4: từng testcase một, không chờ chấm xong cả bài.
          void emit(`submission:${job.id}`, {
            id: job.id,
            status: 'running',
            result: { position: r.position, isSample: r.isSample, verdict: r.verdict, timeMs: r.timeMs },
          })
        },
        log: (m) => console.log(`[worker:${slot}] ${job.id} ${m}`),
      },
    )

    const testcaseIds = new Map(ctx.testcases.map((t, i) => [t.position, i]))
    const ok = await finish(job.id, WORKER_ID, job.attempt, {
      verdict: outcome.verdict,
      passedWeight: outcome.passedWeight,
      totalWeight: outcome.totalWeight,
      timeMsMax: outcome.timeMsMax,
      memoryKbMax: outcome.memoryKbMax,
      compileOutput: outcome.compileOutput,
      judgeMs: outcome.judgeMs,
      ieReason: outcome.ieReason,
      testcaseRev: ctx.testcaseRev,
      results: outcome.results.map((r) => ({
        position: r.position,
        testcaseId: null,
        isSample: r.isSample,
        verdict: r.verdict,
        timeMs: r.timeMs,
        memoryKb: r.memoryKb,
        exitCode: r.exitCode,
        termSignal: r.termSignal,
        detail: r.detail,
        // ADR-10: stdout/stderr chỉ ghi cho testcase MẪU — kỷ luật không-bao-giờ-ghi.
        stdout: r.stdout,
        stderr: r.stderr,
        // Mentor thấy stdout của testcase ẩn FAIL ĐẦU TIÊN, không phải mọi test.
        mentorStdout: null,
        firstDiffLine: r.firstDiffLine,
      })),
    })
    if (!ok) {
      console.warn(`[worker:${slot}] ${job.id} đã bị reaper thu hồi — bỏ kết quả của attempt ${job.attempt}`)
      return
    }

    // FR-D6: validate xanh thì ghi mốc cho cổng mềm lúc xuất bản.
    if (job.runTarget === 'validate' && outcome.verdict === 'AC') {
      await db.execute(sql`
        UPDATE problems SET validated_testcase_rev = testcase_rev, validated_at = now()
        WHERE id = ${job.problemId}
      `)
    }

    await emit(`submission:${job.id}`, { id: job.id, status: 'done', verdict: outcome.verdict })
    if (job.contestId && job.kind === 'submit') {
      await emit(`contest:${job.contestId}`, { kind: 'standings.changed' })
    }
    console.log(
      `[worker:${slot}] ${job.kind} ${job.id} → ${outcome.verdict} (${outcome.judgeMs} ms, chờ ${job.queuedMs} ms)`,
    )
  } catch (err) {
    console.error(`[worker:${slot}] ${job.id} IE:`, err)
    await finish(job.id, WORKER_ID, job.attempt, {
      verdict: 'IE',
      passedWeight: 0,
      totalWeight: 0,
      timeMsMax: 0,
      memoryKbMax: 0,
      compileOutput: '',
      judgeMs: 0,
      ieReason: String(err).slice(0, 200),
      testcaseRev: null,
      results: [],
    })
  } finally {
    clearInterval(beat)
  }
}

/** Nhận và chấm ĐÚNG MỘT việc — dùng cho test tích hợp và cho vòng lặp slot. */
export async function processOneJob(slot = 0): Promise<ClaimedSubmission | null> {
  const job = await claimNext(WORKER_ID, slot)
  if (!job) return null
  await runJob(job, slot)
  return job
}

async function slotLoop(slot: number): Promise<void> {
  while (!stopping) {
    let job: ClaimedSubmission | null = null
    try {
      job = await claimNext(WORKER_ID, slot)
    } catch (err) {
      console.error(`[worker:${slot}] claim lỗi:`, err)
    }
    if (!job) {
      await sleep(IDLE_POLL_MS)
      continue
    }
    if (stopping) {
      await requeue(job.id, WORKER_ID, job.attempt)
      return
    }
    await runJob(job, slot)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function registerWorker(): Promise<void> {
  await db.execute(sql`
    INSERT INTO workers (id, slots, version) VALUES (${WORKER_ID}, ${config.workerSlots}, 'p2')
    ON CONFLICT (id) DO UPDATE SET slots = ${config.workerSlots}, last_seen_at = now()
  `)
}

/** Probe ngôn ngữ lúc khởi động (§3.1): image tồn tại chưa đủ — phải biên dịch nổi. */
async function probeLanguages(): Promise<void> {
  const rows = await q<LanguageRow>(sql`
    SELECT id, name, image, source_filename, compile_argv, run_argv, time_factor, memory_extra_mb, enabled
    FROM languages WHERE enabled = true ORDER BY position
  `)
  const HELLO: Record<string, string> = {
    c11: '#include <stdio.h>\nint main(void){printf("ok\\n");return 0;}\n',
    cpp17: '#include <iostream>\nint main(){std::cout<<"ok\\n";}\n',
    python3: 'print("ok")\n',
    java17: 'public class Main{public static void main(String[] a){System.out.println("ok");}}\n',
    node20: 'console.log("ok")\n',
  }
  for (const row of rows) {
    const source = HELLO[row.id]
    if (!source) {
      console.warn(`[worker] không có mẫu probe cho ${row.id} — bỏ qua`)
      continue
    }
    try {
      const outcome = await judgeSubmission({
        language: toLanguageConfig(row, DEFAULT_LIMITS),
        source,
        testcases: [{ position: 1, isSample: true, weight: 1, input: Buffer.alloc(0), expected: Buffer.from('ok\n') }],
        limits: { ...DEFAULT_LIMITS, timeLimitMs: 5000 },
      })
      if (outcome.verdict !== 'AC') {
        console.error(`[worker] ngôn ngữ ${row.id} KHÔNG chạy được (${outcome.verdict}) — tắt tạm thời`)
        await db.execute(sql`UPDATE languages SET enabled = false WHERE id = ${row.id}`)
      } else {
        console.log(`[worker] ngôn ngữ ${row.id}: ok (${outcome.judgeMs} ms)`)
      }
    } catch (err) {
      console.error(`[worker] probe ${row.id} lỗi:`, err)
      await db.execute(sql`UPDATE languages SET enabled = false WHERE id = ${row.id}`)
    }
  }
}

export async function startWorker(): Promise<void> {
  console.log(`[worker] ${WORKER_ID}, ${config.workerSlots} slot`)
  await registerWorker()
  const orphans = await reapOrphanSandboxes()
  if (orphans > 0) console.log(`[worker] dọn ${orphans} container mồ côi`)
  if (process.env.SKIP_LANGUAGE_PROBE !== '1') await probeLanguages()

  const beat = setInterval(() => {
    void db.execute(sql`UPDATE workers SET last_seen_at = now() WHERE id = ${WORKER_ID}`)
    void reapStale()
  }, 10_000)

  const hourly = setInterval(() => {
    void purgeOld().then((r) => {
      if (r.runs || r.events) console.log(`[worker] dọn ${r.runs} run, ${r.events} event`)
    })
  }, 3_600_000)

  const slots = Array.from({ length: config.workerSlots }, (_, i) => slotLoop(i))

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      if (stopping) return
      stopping = true
      console.log(`[worker] ${signal} — chấm nốt testcase hiện tại rồi thoát`)
      clearInterval(beat)
      clearInterval(hourly)
      setTimeout(() => process.exit(0), 90_000).unref()
    })
  }

  await Promise.all(slots)
  clearInterval(beat)
  clearInterval(hourly)
  await closePool()
}

if (import.meta.filename === process.argv[1]) {
  await startWorker()
}
