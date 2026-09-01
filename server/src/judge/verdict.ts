/**
 * Bảng quyết định verdict cho MỘT testcase (design.md §3.4).
 * Thứ tự xét là một phần của đặc tả — không đảo.
 */
import { compareOutput } from './compare'
import type { CompareMode, JudgeMeta, Verdict } from './types'

export interface VerdictInput {
  meta: JudgeMeta | null
  stdout: Buffer
  expected: Buffer | null
  outputTruncated: boolean
  /** Lỗi tầng hệ thống đã biết (docker, exec, đọc testcase từ DB…) → IE. */
  systemError?: string | null
  /** Giới hạn thời gian hiệu dụng (giây) = time_limit_ms × time_factor. */
  effectiveTimeLimitSec: number
  memoryLimitKb: number
  compareMode: CompareMode
  floatEps?: number
}

export interface VerdictOutput {
  verdict: Verdict
  detail: string | null
  exitCode: number | null
  termSignal: number | null
  firstDiffLine: number | null
}

const SIGNAL_NAMES: Record<number, string> = {
  2: 'SIGINT',
  4: 'SIGILL',
  6: 'SIGABRT',
  8: 'SIGFPE',
  9: 'SIGKILL',
  11: 'SIGSEGV',
  13: 'SIGPIPE',
  15: 'SIGTERM',
  24: 'SIGXCPU',
  25: 'SIGXFSZ',
}

export function decideVerdict(input: VerdictInput): VerdictOutput {
  const base = { detail: null as string | null, exitCode: null as number | null, termSignal: null as number | null, firstDiffLine: null as number | null }

  // 1. Lỗi hệ thống / không có meta → IE (không bao giờ tính lên đầu member).
  if (input.systemError) return { ...base, verdict: 'IE', detail: input.systemError }
  const meta = input.meta
  if (!meta) return { ...base, verdict: 'IE', detail: 'no_meta' }

  const st = meta.st
  const killedBySignal = st > 128 && st < 256
  const signal = killedBySignal ? st - 128 : null
  const exitCode = killedBySignal ? null : st
  const termSignal = signal
  const withProc = { ...base, exitCode, termSignal }

  // 2. Bộ nhớ.
  if (meta.oom > 0 || meta.rssKb > input.memoryLimitKb) {
    return { ...withProc, verdict: 'MLE', detail: meta.oom > 0 ? 'cgroup_oom' : 'maxrss_over_limit' }
  }

  // 3. Thời gian: CPU chạm trần, hoặc bị `timeout` giết ở wall.
  //    SIGKILL do CHÍNH worker gửi khi output tràn KHÔNG phải TLE — ca đó thuộc
  //    dòng 4 (§3.4 nói rõ dòng 3 là "st=137 từ timeout").
  const cpuOverLimit = meta.cpu >= input.effectiveTimeLimitSec
  if (cpuOverLimit || (signal === 9 && !input.outputTruncated)) {
    return { ...withProc, verdict: 'TLE', detail: cpuOverLimit ? 'cpu_limit' : 'wall_kill' }
  }

  // 4. Output vượt trần.
  if (input.outputTruncated) return { ...withProc, verdict: 'RE', detail: 'output_limit' }

  // 5. Thoát bất thường.
  if (st !== 0) {
    const detail = signal !== null ? (SIGNAL_NAMES[signal] ?? `signal_${signal}`) : `exit_${st}`
    return { ...withProc, verdict: 'RE', detail }
  }

  // 6. So output.
  if (input.expected !== null) {
    const cmp = compareOutput(input.stdout, input.expected, input.compareMode, input.floatEps)
    if (!cmp.ok) return { ...withProc, verdict: 'WA', firstDiffLine: cmp.firstDiffLine }
  }

  // 7. Còn lại.
  return { ...withProc, verdict: 'AC' }
}

/** Verdict tổng của submission (FR-F2): AC khi mọi test AC, ngược lại là lỗi đầu tiên. */
export function overallVerdict(results: { position: number; verdict: Verdict }[]): Verdict {
  if (results.length === 0) return 'IE'
  const ordered = [...results].sort((a, b) => a.position - b.position)
  if (ordered.some((r) => r.verdict === 'IE')) return 'IE'
  const failed = ordered.find((r) => r.verdict !== 'AC')
  return failed ? failed.verdict : 'AC'
}
