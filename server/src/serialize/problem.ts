/**
 * Cổng chặn dữ liệu ẩn cho bài tập (NFR-2).
 *
 * Member KHÔNG BAO GIỜ thấy: testcase ẩn (input/expected), lời giải tham khảo,
 * và đề của contest chưa bắt đầu (embargo — kiểm ở tầng route, §5).
 */
import type { RawSubmissionRow } from './submission'

export interface RawProblemRow {
  id: string
  title: string
  statementMd: string
  inputDescMd: string | null
  outputDescMd: string | null
  constraintsMd: string | null
  examples: unknown
  timeLimitMs: number | null
  memoryLimitMb: number | null
  difficulty: string | null
  tags: string[]
  allowedLanguageIds: string[] | null
  compareMode: string
  starterCode: unknown
  solutionLanguageId: string | null
  solutionSource: string | null
  solutionVisibility: string
  testcaseRev: number
}

export interface RawTestcaseRow {
  id: string
  position: number
  kind: string
  weight: number
  input: Buffer
  expected: Buffer | null
}

export interface MemberSampleView {
  position: number
  input: string
  expected: string | null
}

export interface MemberProblemView {
  id: string
  title: string
  statementMd: string
  inputDescMd: string | null
  outputDescMd: string | null
  constraintsMd: string | null
  examples: unknown
  timeLimitMs: number
  memoryLimitMb: number
  difficulty: string | null
  tags: string[]
  allowedLanguageIds: string[] | null
  starterCode: unknown
  /** Chỉ testcase MẪU. Test ẩn chỉ lộ ra dưới dạng con số. */
  samples: MemberSampleView[]
  hiddenTestcaseCount: number
  /** Cấm với member — khai kiểu để rò rỉ thành lỗi biên dịch. */
  solutionSource?: never
  hiddenTestcases?: never
}

export function toMemberProblem(
  problem: RawProblemRow,
  testcases: RawTestcaseRow[],
  defaults: { timeLimitMs: number; memoryLimitMb: number },
): MemberProblemView {
  const samples = testcases.filter((t) => t.kind === 'sample')
  return {
    id: problem.id,
    title: problem.title,
    statementMd: problem.statementMd,
    inputDescMd: problem.inputDescMd,
    outputDescMd: problem.outputDescMd,
    constraintsMd: problem.constraintsMd,
    examples: problem.examples,
    timeLimitMs: problem.timeLimitMs ?? defaults.timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb ?? defaults.memoryLimitMb,
    difficulty: problem.difficulty,
    tags: problem.tags,
    allowedLanguageIds: problem.allowedLanguageIds,
    starterCode: problem.starterCode,
    samples: samples.map((t) => ({
      position: t.position,
      input: t.input.toString('utf8'),
      expected: t.expected?.toString('utf8') ?? null,
    })),
    hiddenTestcaseCount: testcases.length - samples.length,
  }
}

/** FR-D7: lời giải chỉ mở cho member theo chính sách của bài. */
export function mayMemberSeeSolution(
  problem: Pick<RawProblemRow, 'solutionVisibility'>,
  ctx: { hasAc: boolean; contestEnded: boolean | null },
): boolean {
  switch (problem.solutionVisibility) {
    case 'after_ac':
      return ctx.hasAc
    case 'after_contest':
      return ctx.contestEnded === true
    case 'mentor':
    default:
      return false
  }
}

export interface MentorProblemView extends Omit<MemberProblemView, 'solutionSource' | 'hiddenTestcases'> {
  compareMode: string
  testcaseRev: number
  solutionLanguageId: string | null
  solutionSource: string | null
  solutionVisibility: string
  testcases: {
    id: string
    position: number
    kind: string
    weight: number
    inputPreview: string
    expectedPreview: string | null
    inputBytes: number
    expectedBytes: number | null
  }[]
}

const PREVIEW_BYTES = 2048

export function toMentorProblem(
  problem: RawProblemRow,
  testcases: RawTestcaseRow[],
  defaults: { timeLimitMs: number; memoryLimitMb: number },
): MentorProblemView {
  const member = toMemberProblem(problem, testcases, defaults)
  return {
    ...member,
    compareMode: problem.compareMode,
    testcaseRev: problem.testcaseRev,
    solutionLanguageId: problem.solutionLanguageId,
    solutionSource: problem.solutionSource,
    solutionVisibility: problem.solutionVisibility,
    testcases: testcases.map((t) => ({
      id: t.id,
      position: t.position,
      kind: t.kind,
      weight: t.weight,
      inputPreview: t.input.subarray(0, PREVIEW_BYTES).toString('utf8'),
      expectedPreview: t.expected?.subarray(0, PREVIEW_BYTES).toString('utf8') ?? null,
      inputBytes: t.input.length,
      expectedBytes: t.expected?.length ?? null,
    })),
  }
}

/** Bài nộp của chính member gắn với bài — dùng ở tab "Bài nộp" (FR-E3). */
export type { RawSubmissionRow }
