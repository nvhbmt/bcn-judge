/**
 * Chấm một submission từ đầu tới cuối (design.md §3.2).
 *
 *   tạo container (cỡ biên dịch) → nạp source → biên dịch → thu hẹp lồng bộ nhớ
 *   → chạy từng testcase (input qua stdin) → huỷ container
 *
 * Hàm này thuần judge: không đụng DB, không đụng HTTP. Queue/worker gọi nó.
 */
import type { LanguageConfig } from './languages'
import { PIDS_POISON_THRESHOLD, Sandbox } from './sandbox'
import type { JudgeLimits, JudgeOutcome, SourceFile, TestcaseInput, TestcaseResult, Verdict } from './types'
import { decideVerdict, overallVerdict } from './verdict'

export interface JudgeRequest {
  language: LanguageConfig
  /**
   * Các file nạp vào /w, theo thứ tự. Bài stdio có một file; bài dạng function có
   * harness + mã người học. Tầng này không biết file nào của ai — nó chỉ nạp rồi
   * chạy `compileArgv`, nên thêm dạng bài mới không phải sửa ở đây.
   */
  files: SourceFile[]
  testcases: TestcaseInput[]
  limits: JudgeLimits
  /** Pin core cho slot (§3.2); bỏ trống khi chạy dev. */
  cpusetCpus?: string
  labels?: Record<string, string>
}

export interface JudgeHooks {
  /** Gọi sau mỗi testcase — worker dùng để stream verdict từng test (FR-F4). */
  onTestcase?: (result: TestcaseResult) => void | Promise<void>
  onCompiled?: (compileOutput: string) => void | Promise<void>
  log?: (message: string) => void
}

const COMPILE_STDERR_BYTES = 64 * 1024
/** stdout/stderr lưu cho testcase mẫu (ADR-10). */
const SAMPLE_STDOUT_BYTES = 64 * 1024
const SAMPLE_STDERR_BYTES = 8 * 1024
/** Chỉ mentor đọc được — dùng cho diff của FR-D6/US-2 (§2.6). */
const MENTOR_STDOUT_BYTES = 4 * 1024

function ceilSec(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000))
}

export async function judgeSubmission(req: JudgeRequest, hooks: JudgeHooks = {}): Promise<JudgeOutcome> {
  const startedAt = Date.now()
  const { language, limits } = req
  const effectiveTimeSec = (limits.timeLimitMs * language.timeFactor) / 1000
  const runMemoryMb = limits.memoryLimitMb + language.memoryExtraMb + 16
  const memoryLimitKb = limits.memoryLimitMb * 1024
  const testcases = [...req.testcases].sort((a, b) => a.position - b.position)
  const totalWeight = testcases.reduce((sum, tc) => sum + tc.weight, 0)

  const newSandbox = () =>
    Sandbox.create({
      image: language.image,
      memoryMb: limits.compileMemoryMb,
      maxOutputBytes: limits.maxOutputBytes,
      cpus: 1,
      ...(req.cpusetCpus ? { cpusetCpus: req.cpusetCpus } : {}),
      ...(req.labels ? { labels: req.labels } : {}),
    })

  const fail = (verdict: Verdict, ieReason: string | null, compileOutput = ''): JudgeOutcome => ({
    verdict,
    compileOutput,
    results: [],
    passedWeight: 0,
    totalWeight,
    score: 0,
    timeMsMax: 0,
    memoryKbMax: 0,
    ieReason,
    judgeMs: Date.now() - startedAt,
  })

  let sandbox: Sandbox
  try {
    sandbox = await newSandbox()
  } catch (err) {
    hooks.log?.(`tạo container thất bại: ${String(err)}`)
    return fail('IE', 'sandbox_create_failed')
  }

  /** Nạp source + biên dịch. Trả về compileOutput, hoặc ném để báo CE/IE. */
  const prepare = async (sb: Sandbox): Promise<{ ok: boolean; output: string; ie: string | null }> => {
    for (const file of req.files) await sb.putSource(file.name, file.content)
    if (!language.compileArgv) return { ok: true, output: '', ie: null }

    const compileSec = ceilSec(limits.compileTimeLimitMs)
    const outcome = await sb.exec(
      [
        '/opt/judge/run.sh',
        '--cpu',
        String(compileSec),
        '--wall',
        String(compileSec + 5),
        '--out',
        String(COMPILE_STDERR_BYTES),
        '--',
        ...language.compileArgv,
      ],
      {
        maxOutputBytes: COMPILE_STDERR_BYTES,
        wallDeadlineMs: (compileSec + 10) * 1000,
        maxStderrBytes: COMPILE_STDERR_BYTES,
      },
    )

    const text = [outcome.stdout.toString('utf8'), outcome.stderr].filter(Boolean).join('\n').slice(0, COMPILE_STDERR_BYTES)
    if (outcome.timedOut || !outcome.meta) return { ok: false, output: text, ie: 'compile_no_meta' }
    if (outcome.meta.st !== 0) return { ok: false, output: text || 'Biên dịch thất bại.', ie: null }
    return { ok: true, output: text, ie: null }
  }

  let compileOutput = ''
  try {
    const prepared = await prepare(sandbox)
    compileOutput = prepared.output
    if (!prepared.ok) {
      await sandbox.destroy()
      return prepared.ie
        ? fail('IE', prepared.ie, compileOutput)
        : { ...fail('CE', null, compileOutput), verdict: 'CE' }
    }
    await hooks.onCompiled?.(compileOutput)
    await sandbox.updateMemory(runMemoryMb)
  } catch (err) {
    hooks.log?.(`chuẩn bị sandbox thất bại: ${String(err)}`)
    await sandbox.destroy()
    return fail('IE', 'sandbox_prepare_failed', compileOutput)
  }

  const results: TestcaseResult[] = []
  let passedWeight = 0
  let timeMsMax = 0
  let memoryKbMax = 0

  for (const tc of testcases) {
    let outcome
    let systemError: string | null = null
    try {
      outcome = await sandbox.exec(
        [
          '/opt/judge/run.sh',
          '--cpu',
          String(ceilSec(limits.timeLimitMs * language.timeFactor) + 1),
          // wall = 2T + 2s (FR-H2 v0.5)
          '--wall',
          (2 * effectiveTimeSec + 2).toFixed(1),
          '--out',
          String(limits.maxOutputBytes),
          // Trần ghi file chặt chỉ áp cho lượt chạy (hạ hard limit thì luôn được).
          '--fsize',
          String(limits.maxOutputBytes + 1024 * 1024),
          '--',
          ...language.runArgv,
        ],
        {
          stdin: tc.input,
          maxOutputBytes: limits.maxOutputBytes,
          wallDeadlineMs: Math.round((2 * effectiveTimeSec + 2 + 5) * 1000),
          maxStderrBytes: SAMPLE_STDERR_BYTES,
        },
      )
    } catch (err) {
      hooks.log?.(`exec testcase ${tc.position} lỗi: ${String(err)}`)
      systemError = 'exec_failed'
      outcome = null
    }

    const decision = decideVerdict({
      meta: outcome?.meta ?? null,
      stdout: outcome?.stdout ?? Buffer.alloc(0),
      expected: tc.expected,
      outputTruncated: outcome?.outputTruncated ?? false,
      systemError: systemError ?? (outcome?.timedOut ? 'worker_deadline' : null),
      effectiveTimeLimitSec: effectiveTimeSec,
      memoryLimitKb,
      compareMode: limits.compareMode,
      ...(limits.floatEps !== undefined ? { floatEps: limits.floatEps } : {}),
    })

    const timeMs = Math.round((outcome?.meta?.wall ?? 0) * 1000)
    const memoryKb = outcome?.meta?.rssKb ?? 0
    timeMsMax = Math.max(timeMsMax, timeMs)
    memoryKbMax = Math.max(memoryKbMax, memoryKb)
    if (decision.verdict === 'AC') passedWeight += tc.weight

    const result: TestcaseResult = {
      position: tc.position,
      isSample: tc.isSample,
      weight: tc.weight,
      verdict: decision.verdict,
      timeMs,
      memoryKb,
      exitCode: decision.exitCode,
      termSignal: decision.termSignal,
      detail: decision.detail,
      // ADR-10: cột stdout/stderr có thể được serve cho member nên CHỈ ghi cho
      // testcase mẫu — test ẩn để null theo cấu trúc, không phải theo trí nhớ.
      stdout: tc.isSample ? (outcome?.stdout.subarray(0, SAMPLE_STDOUT_BYTES).toString('utf8') ?? null) : null,
      stderr: tc.isSample ? (outcome?.stderr.slice(0, SAMPLE_STDERR_BYTES) ?? null) : null,
      // Bản sao RIÊNG cho mentor (serializer member khai kiểu never cho cột này).
      mentorStdout: outcome?.stdout.subarray(0, MENTOR_STDOUT_BYTES).toString('utf8') ?? null,
      firstDiffLine: decision.firstDiffLine,
    }
    results.push(result)
    await hooks.onTestcase?.(result)

    // Namespace nhiễm độc (fork bomb ghim pids): pkill không fork nổi, tiến trình
    // của member sống sang test kế → thay container mới cho các test còn lại (§3.2).
    const pids = outcome?.meta?.pids ?? 0
    const poisoned = pids > PIDS_POISON_THRESHOLD
    const isLast = tc.position === testcases[testcases.length - 1]?.position
    if ((poisoned || outcome?.timedOut) && !isLast) {
      hooks.log?.(`container nhiễm độc sau test ${tc.position} (pids=${pids}) — thay container mới`)
      await sandbox.destroy()
      try {
        sandbox = await newSandbox()
        const again = await prepare(sandbox)
        if (!again.ok) {
          await sandbox.destroy()
          return fail('IE', 'recycle_prepare_failed', compileOutput)
        }
        await sandbox.updateMemory(runMemoryMb)
      } catch (err) {
        hooks.log?.(`thay container thất bại: ${String(err)}`)
        return fail('IE', 'recycle_failed', compileOutput)
      }
    }
  }

  await sandbox.destroy()

  const verdict = overallVerdict(results)
  const score = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100 * 100) / 100 : 0

  return {
    verdict,
    compileOutput,
    results,
    passedWeight,
    totalWeight,
    score,
    timeMsMax,
    memoryKbMax,
    ieReason: verdict === 'IE' ? (results.find((r) => r.verdict === 'IE')?.detail ?? 'testcase_ie') : null,
    judgeMs: Date.now() - startedAt,
  }
}
