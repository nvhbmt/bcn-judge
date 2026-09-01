/** Kiểu dùng chung cho tầng judge (design.md §3). */

export type Verdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'IE'

export type CompareMode = 'trim' | 'exact' | 'float'

/** Dòng `__JUDGE_META__` do run.sh in ra (root ghi — member không giả mạo được). */
export interface JudgeMeta {
  /** Exit status của tiến trình member (128+signal nếu bị kill). */
  st: number
  /** Wall time (giây). */
  wall: number
  /** CPU time = user + sys (giây). */
  cpu: number
  /** Max RSS (KB). */
  rssKb: number
  /** Delta `oom_kill` của cgroup trong lần chạy này. */
  oom: number
  /** `pids.current` sau khi pkill — dùng phát hiện namespace nhiễm độc (§3.2). */
  pids: number
  /** 1 = đã hạ được bounding set của capability; 0 = lớp siết đó KHÔNG áp được
   *  (thiếu CAP_SETPCAP hoặc util-linux quá mới) — worker phải cảnh báo, không im lặng. */
  bset: number
}

export interface TestcaseInput {
  position: number
  isSample: boolean
  weight: number
  input: Buffer
  expected: Buffer | null
}

export interface JudgeLimits {
  timeLimitMs: number
  memoryLimitMb: number
  maxOutputBytes: number
  compileTimeLimitMs: number
  compileMemoryMb: number
  compareMode: CompareMode
  floatEps?: number
}

export const DEFAULT_LIMITS: JudgeLimits = {
  // FR-H2 v0.5
  timeLimitMs: 1000,
  memoryLimitMb: 256,
  maxOutputBytes: 8 * 1024 * 1024,
  compileTimeLimitMs: 15_000,
  compileMemoryMb: 1024,
  compareMode: 'trim',
}

export interface TestcaseResult {
  position: number
  isSample: boolean
  weight: number
  verdict: Verdict
  timeMs: number
  memoryKb: number
  exitCode: number | null
  termSignal: number | null
  /** `output_limit`, tên signal, … — cột đầy đủ cho mentor (§2.6). */
  detail: string | null
  /** Chỉ ghi cho testcase mẫu — ADR-10 kỷ luật không-bao-giờ-ghi. */
  stdout: string | null
  stderr: string | null
  firstDiffLine: number | null
}

export interface JudgeOutcome {
  verdict: Verdict
  compileOutput: string
  results: TestcaseResult[]
  passedWeight: number
  totalWeight: number
  /** FR-F2 v0.5: điểm bài chuẩn hoá 0–100, làm tròn 2 chữ số. */
  score: number
  timeMsMax: number
  memoryKbMax: number
  /** Lý do IE (chỉ khi verdict = IE) — dùng cho requeue FR-F8. */
  ieReason: string | null
  judgeMs: number
}
