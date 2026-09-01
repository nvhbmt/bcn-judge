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
  claimRejudge,
  finish,
  finishRejudge,
  heartbeat,
  purgeOld,
  reapRejudge,
  releaseRejudge,
  reapStale,
  requeue,
  type ClaimedSubmission,
  type RejudgeJob,
} from './judge/queue'
import { judgeSubmission } from './judge/runner'
import { reapOrphanSandboxes } from './judge/sandbox'
import { DEFAULT_LIMITS, type JudgeLimits, type SourceFile, type TestcaseInput } from './judge/types'
import { getSettings } from './lib/settings'

export const WORKER_ID = `${hostname()}-${process.pid}`
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
  /** Chỉ có ở truy vấn của loadJob; probeLanguages không cần nên để tuỳ chọn. */
  function_source_filename?: string | null
  compile_argv_function?: string[] | null
}

function toLanguageConfig(row: LanguageRow, limits: JudgeLimits, kind = 'stdio'): LanguageConfig {
  const substitute = (arg: string) =>
    arg
      .replace('{memory_mb}', String(limits.memoryLimitMb))
      .replace('{time_s}', String(Math.ceil((limits.timeLimitMs * Number(row.time_factor)) / 1000)))
  // Dạng function biên dịch hai file, và vài ngôn ngữ phải nêu đích danh cả hai
  // (javac) hoặc kiểm cú pháp thêm file của người học (py_compile, node --check).
  const compile =
    kind === 'function' && row.compile_argv_function ? row.compile_argv_function : row.compile_argv
  return {
    id: row.id,
    label: row.name,
    image: row.image,
    sourceFilename: row.source_filename,
    functionSourceFilename: row.function_source_filename ?? null,
    compileArgv: compile?.map(substitute) ?? null,
    compileArgvFunction: row.compile_argv_function?.map(substitute) ?? null,
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
  /** Đã ghép sẵn theo dạng bài: stdio một file, function là harness + solution. */
  files: SourceFile[]
}

/**
 * Ghép danh sách file nạp vào sandbox.
 *
 * Bài stdio: đúng một file, y như trước.
 * Bài function: harness của mentor chiếm chỗ `sourceFilename` (main.c, Main.java…)
 * vì nó là điểm vào, mã người học nằm ở `functionSourceFilename` và được harness
 * gọi tới. Thiếu harness cho ngôn ngữ đang nộp là lỗi CẤU HÌNH của bài, không
 * phải lỗi người học — nên ném ra để thành IE, và route nộp bài đã chặn từ trước.
 */
function buildFiles(
  kind: string,
  language: LanguageConfig,
  harness: Record<string, string>,
  userSource: string,
): SourceFile[] {
  if (kind !== 'function') return [{ name: language.sourceFilename, content: userSource }]

  const harnessSource = harness[language.id]
  if (!harnessSource) throw new Error('harness_missing')
  if (!language.functionSourceFilename) throw new Error('language_no_function_support')
  // Hai tên này đi từ bảng `languages` — admin sửa được ở trang quản trị. Đặt trùng
  // nhau thì `prepare` ghi tuần tự và mã người học ĐÈ LÊN harness, rồi chẩn đoán của
  // chính họ bị lọc như của mentor: bài hỏng theo cách không ai đọc ra được. Thà IE
  // với một lý do gọi đúng tên vấn đề.
  if (language.functionSourceFilename === language.sourceFilename) {
    throw new Error('function_source_filename_collision')
  }
  return [
    // owner:'mentor' → chẩn đoán biên dịch thuộc file này bị giấu khỏi người học,
    // vì trình biên dịch in lại dòng nguồn gây lỗi (compileOutput.ts).
    { name: language.sourceFilename, content: harnessSource, owner: 'mentor' },
    { name: language.functionSourceFilename, content: userSource, owner: 'member' },
  ]
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
    kind: string
    harness: Record<string, string> | null
  }>(sql`
    SELECT time_limit_ms, memory_limit_mb, compare_mode, float_eps, testcase_rev, solution_source,
           kind, harness
    FROM problems WHERE id = ${job.problemId}
  `)
  if (!problem) throw new Error('problem_not_found')

  const [langRow] = await q<LanguageRow>(sql`
    SELECT id, name, image, source_filename, function_source_filename,
           compile_argv, compile_argv_function, run_argv, time_factor, memory_extra_mb, enabled
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
    const language = toLanguageConfig(langRow, limits, problem.kind)
    return {
      language,
      limits,
      testcaseRev: problem.testcase_rev,
      files: buildFiles(problem.kind, language, problem.harness ?? {}, job.source),
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

  const language = toLanguageConfig(langRow, limits, problem.kind)
  return {
    language,
    limits,
    testcaseRev: problem.testcase_rev,
    // FR-D6: validate chấm chính LỜI GIẢI MẪU của bài, không phải source người gửi.
    // Ở dạng function, lời giải mẫu cũng chỉ là "một hàm nữa" đi qua cùng harness.
    files: buildFiles(
      problem.kind,
      language,
      problem.harness ?? {},
      job.runTarget === 'validate' ? (problem.solution_source ?? job.source) : job.source,
    ),
    testcases: rows.map((r) => ({
      position: r.position,
      isSample: r.kind === 'sample',
      weight: r.weight,
      input: r.input,
      expected: r.expected,
    })),
  }
}

const MENTOR_STDOUT_CAP = 4096

/**
 * Ai được xem stdout nào — xem ADR-10; giới hạn 4 KB mỗi testcase.
 *
 * Đọc `result.mentorStdout`, KHÔNG phải `result.stdout`. `runner.ts` cố ý đặt
 * `stdout: null` cho mọi testcase ẩn (đó là cột member đọc được) và để bản đầy đủ ở
 * `mentorStdout`. Bản trước đọc nhầm cột nên điều kiện `!result.stdout` đúng với
 * MỌI testcase ẩn → `mentor_stdout` luôn null, và cột `mentorStdout` mà runner tính
 * ở dòng 212 chưa từng được dùng. US-2 ("báo rõ testcase 7 kèm diff") vì thế không
 * hoạt động ngày nào: mentor điều tra một verdict đáng ngờ mà không có gì để nhìn.
 */
function mentorStdoutFor(
  result: { position: number; isSample: boolean; verdict: string; mentorStdout: string | null },
  job: ClaimedSubmission,
  all: { position: number; isSample: boolean; verdict: string }[],
): string | null {
  if (result.verdict === 'AC' || !result.mentorStdout) return null
  if (job.runTarget === 'validate') return result.mentorStdout.slice(0, MENTOR_STDOUT_CAP)
  const firstHiddenFail = all.find((r) => !r.isSample && r.verdict !== 'AC')
  return firstHiddenFail?.position === result.position
    ? result.mentorStdout.slice(0, MENTOR_STDOUT_CAP)
    : null
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
        files: ctx.files,
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
        // ADR-10: với run VALIDATE mentor thấy stdout của MỌI testcase fail (đó là
        // cách US-2 "báo rõ testcase 7 kèm diff" thành hiện thực); với submit chỉ
        // testcase ẩn FAIL ĐẦU TIÊN. Cột này chỉ mentor đọc được (serializer).
        mentorStdout: mentorStdoutFor(r, job, outcome.results),
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

/**
 * Chấm lại một bài nộp (FR-D9). Chạy như việc NỀN: `claimRejudge` chỉ trả việc
 * khi cả hai băng run/submit trống, nên chấm lại không bao giờ chen trước member.
 * Bài nộp không rời `status='done'` suốt quá trình — bảng xếp hạng không mất dòng.
 */
export async function processOneRejudge(slot = 0): Promise<RejudgeJob | null> {
  const job = await claimRejudge(WORKER_ID)
  if (!job) return null

  try {
    const ctx = await loadJob(job)
    const outcome = await judgeSubmission({
      language: ctx.language,
      files: ctx.files,
      testcases: ctx.testcases,
      limits: ctx.limits,
      labels: { 'bcnjudge.rejudge': job.id, 'bcnjudge.worker': WORKER_ID },
    })
    const ok = await finishRejudge(job.id, WORKER_ID, job.shadowAttempt, {
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
        stdout: r.stdout,
        stderr: r.stderr,
        mentorStdout: null,
        firstDiffLine: r.firstDiffLine,
      })),
    })
    if (ok) {
      console.log(`[worker:${slot}] chấm lại ${job.id} → ${outcome.verdict}`)
      if (job.contestId) await emit(`contest:${job.contestId}`, { kind: 'standings.changed' })
    }
    return job
  } catch (err) {
    console.error(`[worker:${slot}] chấm lại ${job.id} lỗi:`, err)
    // Nhả claim của CHÍNH mình, không đi qua reaper: reaper chỉ nhả claim quá 5 phút
    // của worker đã mất tích, mà worker này vừa claim xong và đang sống — nó nhả được
    // 0 việc, và dòng chấm lại kẹt vĩnh viễn. Xem releaseRejudge().
    await releaseRejudge(job.id, WORKER_ID).catch((e) =>
      console.error(`[worker:${slot}] nhả claim chấm lại ${job.id} hỏng:`, e),
    )
    return job
  }
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
      // Rảnh mới đụng tới hàng đợi chấm lại (§2.6).
      const rejudged = await processOneRejudge(slot).catch(() => null)
      if (!rejudged) await sleep(IDLE_POLL_MS)
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

/**
 * Cập nhật nhịp tim của worker này.
 *
 * Tách thành hàm riêng để kiểm được: bản trước gọi thẳng `void db.execute(...)`
 * trong callback của `setInterval`, và vì builder của drizzle chỉ chạy khi được
 * `await`/`.then()`, câu UPDATE KHÔNG BAO GIỜ được gửi. Hệ quả: `last_seen_at`
 * đứng yên ở lúc đăng ký, nên sau 30 giây trang /quan-tri báo "Không có worker
 * nào sống" trong khi worker vẫn chấm bài bình thường — báo động giả trên đúng
 * cái bảng điều khiển mà người trực nhìn để quyết định có khởi động lại hay không.
 */
export async function touchWorker(id = WORKER_ID): Promise<void> {
  await db.execute(sql`UPDATE workers SET last_seen_at = now() WHERE id = ${id}`)
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
        files: [{ name: row.source_filename, content: source }],
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
    // KHÔNG viết `void touchWorker()` cho câu drizzle: builder của drizzle là
    // thenable LƯỜI, chỉ gửi câu lệnh khi có ai gọi `.then()`. `void` vứt object
    // đi nên query không bao giờ tới Postgres — và vì không ai chờ, cũng không có
    // lỗi nào để mà thấy. Xem touchWorker() bên dưới.
    //
    // Cả bốn lời gọi trong hai interval này đều PHẢI có `.catch()`. Node 22 mặc định
    // `--unhandled-rejections=throw`: một lỗi DB thoáng qua ở bất kỳ dòng nào dưới
    // đây là giết cả tiến trình worker, và cả cụm mất một slot chấm cho tới khi có
    // người dựng lại. `slotLoop` đã phòng thủ kỹ chuyện này; riêng interval thì chưa.
    touchWorker().catch((err) => console.error('[worker] nhịp tim hỏng:', err))
    reapStale().catch((err) => console.error('[worker] reapStale hỏng:', err))
    reapRejudge().catch((err) => console.error('[worker] reapRejudge hỏng:', err))
  }, 10_000)

  const hourly = setInterval(() => {
    purgeOld()
      .then((r) => {
        if (r.runs || r.events) console.log(`[worker] dọn ${r.runs} run, ${r.events} event`)
      })
      .catch((err) => console.error('[worker] dọn dữ liệu cũ hỏng:', err))
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
