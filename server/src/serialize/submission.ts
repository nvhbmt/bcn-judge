/**
 * Cổng chặn dữ liệu ẩn cho bài nộp (NFR-2, ADR-10 — mẫu serialize/question.ts
 * của imath-test).
 *
 * Nguyên tắc: KHÔNG bao giờ trải rộng (`...row`) một dòng DB ra ngoài. Mọi view
 * dựng từng trường một, và các trường cấm được khai kiểu `never` để rò rỉ trở
 * thành lỗi biên dịch chứ không phải lỗi runtime ai đó phải phát hiện.
 */
import type { Verdict } from '../judge/types'
import { iso } from '../lib/time'

/** Dòng thô từ DB — chỉ tầng serialize được chạm vào. */
export interface RawResultRow {
  position: number
  isSample: boolean
  verdict: string
  timeMs: number | null
  memoryKb: number | null
  exitCode: number | null
  termSignal: number | null
  detail: string | null
  stdout: string | null
  stderr: string | null
  mentorStdout: string | null
  firstDiffLine: number | null
}

export interface RawSubmissionRow {
  id: string
  kind: string
  userId: string
  problemId: string
  itemId: string | null
  contestId: string | null
  contestProblemId: string | null
  languageId: string
  source: string
  sourceBytes: number
  status: string
  verdict: string | null
  passedWeight: number | null
  totalWeight: number | null
  timeMsMax: number | null
  memoryKbMax: number | null
  compileOutput: string | null
  /** drizzle `execute()` trả timestamptz dạng CHUỖI (nó tự map ở tầng query
   *  builder), còn pool thô trả Date — serializer nhận cả hai. */
  receivedAt: Date | string
  finishedAt: Date | string | null
  queuedMs: number | null
  judgeMs: number | null
  attempt: number
}

/** FR-F2 v0.5: điểm bài chuẩn hoá 0–100, làm tròn 2 chữ số — dẫn xuất MỘT chỗ. */
export function scoreOf(passedWeight: number | null, totalWeight: number | null): number | null {
  if (passedWeight === null || !totalWeight) return null
  return Math.round((passedWeight / totalWeight) * 100 * 100) / 100
}

// ── Member: chủ sở hữu bài nộp ────────────────────────────────────────────────

export interface MemberResultView {
  position: number
  isSample: boolean
  verdict: Verdict
  timeMs: number | null
  memoryKb: number | null
  /** Test ẩn: chỉ token chung, KHÔNG exit code / tên signal (kênh byte điều
   *  khiển được — vòng 2 của design). Test mẫu: chi tiết đầy đủ. */
  detail: string | null
  stdout?: string | null
  stderr?: string | null
  firstDiffLine?: number | null
  /** Cấm tuyệt đối với member. */
  expected?: never
  mentorStdout?: never
}

const HIDDEN_DETAIL: Record<string, string> = {
  output_limit: 'output_limit',
  skipped_consecutive_tle: 'skipped',
}

export function toMemberResult(row: RawResultRow): MemberResultView {
  const base = {
    position: row.position,
    isSample: row.isSample,
    verdict: row.verdict as Verdict,
    timeMs: row.timeMs,
    memoryKb: row.memoryKb,
  }
  if (!row.isSample) {
    // Test ẩn: không stdout, không stderr, không diff, không exit code.
    return { ...base, detail: row.detail ? (HIDDEN_DETAIL[row.detail] ?? null) : null }
  }
  return {
    ...base,
    detail: row.detail,
    stdout: row.stdout,
    stderr: row.stderr,
    firstDiffLine: row.firstDiffLine,
  }
}

export interface MemberSubmissionView {
  id: string
  kind: string
  problemId: string
  languageId: string
  status: string
  verdict: Verdict | null
  score: number | null
  passedWeight: number | null
  totalWeight: number | null
  timeMsMax: number | null
  memoryKbMax: number | null
  compileOutput: string | null
  receivedAt: string
  finishedAt: string | null
  results?: MemberResultView[]
  source?: string
  solutionSource?: never
}

export function toMemberSubmission(
  row: RawSubmissionRow,
  results?: RawResultRow[],
  opts: { includeSource?: boolean } = {},
): MemberSubmissionView {
  const view: MemberSubmissionView = {
    id: row.id,
    kind: row.kind,
    problemId: row.problemId,
    languageId: row.languageId,
    status: row.status,
    verdict: row.verdict as Verdict | null,
    score: scoreOf(row.passedWeight, row.totalWeight),
    passedWeight: row.passedWeight,
    totalWeight: row.totalWeight,
    timeMsMax: row.timeMsMax,
    memoryKbMax: row.memoryKbMax,
    compileOutput: row.compileOutput,
    receivedAt: iso(row.receivedAt)!,
    finishedAt: iso(row.finishedAt),
  }
  if (results) view.results = results.map(toMemberResult)
  if (opts.includeSource) view.source = row.source
  return view
}

// ── Leader: bài nộp của đồng đội (FR-J3) ─────────────────────────────────────

export interface LeaderSubmissionView {
  id: string
  userId: string
  problemId: string
  languageId: string
  status: string
  verdict: Verdict | null
  score: number | null
  timeMsMax: number | null
  memoryKbMax: number | null
  receivedAt: string
  /** Source bị hoãn tới sau khi contest kết thúc — chặn kênh chép bài trong
   *  contest (design §14 Delta v0.7, FR-J3 v0.7). */
  source: string | null
  sourceEmbargoedUntil: string | null
  /** Leader chặt hơn cả member: không stdout/stderr/diff kể cả test mẫu. */
  results?: never
  stdout?: never
  stderr?: never
  compileOutput?: never
}

export function toLeaderSubmission(
  row: RawSubmissionRow,
  opts: { contestEndsAt: Date | null; now?: Date },
): LeaderSubmissionView {
  const now = opts.now ?? new Date()
  const embargoed = opts.contestEndsAt !== null && now < opts.contestEndsAt
  return {
    id: row.id,
    userId: row.userId,
    problemId: row.problemId,
    languageId: row.languageId,
    status: row.status,
    verdict: row.verdict as Verdict | null,
    score: scoreOf(row.passedWeight, row.totalWeight),
    timeMsMax: row.timeMsMax,
    memoryKbMax: row.memoryKbMax,
    receivedAt: iso(row.receivedAt)!,
    source: embargoed ? null : row.source,
    sourceEmbargoedUntil: embargoed ? opts.contestEndsAt!.toISOString() : null,
  }
}

// ── Mentor / admin: thấy tất cả ──────────────────────────────────────────────

export interface MentorResultView extends Omit<MemberResultView, 'expected' | 'mentorStdout'> {
  exitCode: number | null
  termSignal: number | null
  mentorStdout: string | null
}

export function toMentorResult(row: RawResultRow): MentorResultView {
  return {
    position: row.position,
    isSample: row.isSample,
    verdict: row.verdict as Verdict,
    timeMs: row.timeMs,
    memoryKb: row.memoryKb,
    detail: row.detail,
    stdout: row.stdout,
    stderr: row.stderr,
    firstDiffLine: row.firstDiffLine,
    exitCode: row.exitCode,
    termSignal: row.termSignal,
    mentorStdout: row.mentorStdout,
  }
}

export function toMentorSubmission(row: RawSubmissionRow, results?: RawResultRow[]) {
  return {
    ...toMemberSubmission(row, undefined, { includeSource: true }),
    userId: row.userId,
    contestId: row.contestId,
    itemId: row.itemId,
    attempt: row.attempt,
    queuedMs: row.queuedMs,
    judgeMs: row.judgeMs,
    results: results?.map(toMentorResult),
  }
}
