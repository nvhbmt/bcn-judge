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
  /** 'stdio' | 'function' — xem drizzle/0003_function_problems.sql. */
  kind: string
  /** {languageId: harness}. CHỈ mentor; member không bao giờ thấy cột này. */
  harness: unknown
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
  floatEps: number | null
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
  /**
   * Dạng bài. Member CẦN biết để giao diện hiện đúng thứ: bài function thì nạp
   * `starterCode` vào trình soạn thảo và nói rõ "chỉ viết hàm, đừng viết main".
   */
  kind: string
  statementMd: string
  inputDescMd: string | null
  outputDescMd: string | null
  constraintsMd: string | null
  examples: unknown
  timeLimitMs: number
  memoryLimitMb: number
  difficulty: string | null
  /** Điểm tối đa theo độ khó (FR-F2 v0.8) — để đề bài nói "bài này đáng 150 điểm". */
  maxPoints: number
  tags: string[]
  /**
   * Cách so output. Member CẦN biết: ở chế độ `trim` thì thừa dấu cách cuối dòng hay
   * một dòng trống ở cuối KHÔNG bị tính sai, còn `exact` thì có — và không nói ra thì
   * người mới học mất hàng giờ đi tìm một lỗi không tồn tại. Không phải dữ liệu ẩn:
   * nó là luật chấm, không phải đáp án.
   */
  compareMode: string
  allowedLanguageIds: string[] | null
  starterCode: unknown
  /** Chỉ testcase MẪU. Test ẩn chỉ lộ ra dưới dạng con số. */
  samples: MemberSampleView[]
  hiddenTestcaseCount: number
  /** Cấm với member — khai kiểu để rò rỉ thành lỗi biên dịch. */
  solutionSource?: never
  hiddenTestcases?: never
  /**
   * Harness chứa cách bài được kiểm — lộ nó là lộ luôn nửa đáp án, và ở bài
   * function nó thường in ra chính giá trị mong đợi. Cấm ở tầng kiểu như
   * `solutionSource`, không dựa vào việc nhớ đừng chọn cột.
   */
  harness?: never
}

export function toMemberProblem(
  problem: RawProblemRow,
  testcases: RawTestcaseRow[],
  defaults: { timeLimitMs: number; memoryLimitMb: number; maxPoints: number },
): MemberProblemView {
  const samples = testcases.filter((t) => t.kind === 'sample')
  return {
    id: problem.id,
    title: problem.title,
    kind: problem.kind,
    statementMd: problem.statementMd,
    inputDescMd: problem.inputDescMd,
    outputDescMd: problem.outputDescMd,
    constraintsMd: problem.constraintsMd,
    examples: problem.examples,
    timeLimitMs: problem.timeLimitMs ?? defaults.timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb ?? defaults.memoryLimitMb,
    difficulty: problem.difficulty,
    maxPoints: defaults.maxPoints,
    compareMode: problem.compareMode,
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

/** Lời giải mẫu của mentor khi bài cho phép member xem (FR-D7) — đi ĐƯỜNG RIÊNG, không kèm đề. */
export interface ReferenceSolutionView {
  languageId: string | null
  source: string
}

export function toReferenceSolution(
  problem: Pick<RawProblemRow, 'solutionVisibility' | 'solutionSource' | 'solutionLanguageId'>,
  ctx: { hasAc: boolean; contestEnded: boolean | null; staff: boolean },
): ReferenceSolutionView | null {
  if (!problem.solutionSource || problem.solutionSource.trim() === '') return null
  if (!ctx.staff && !mayMemberSeeSolution(problem, ctx)) return null
  return { languageId: problem.solutionLanguageId, source: problem.solutionSource }
}

export interface MentorProblemView extends Omit<MemberProblemView, 'solutionSource' | 'hiddenTestcases' | 'harness'> {
  /** {languageId: harness} — chỉ có ở đường mentor. */
  harness: unknown
  compareMode: string
  /** Chỉ có nghĩa khi compareMode = 'float'; null nghĩa là dùng mặc định 1e-6. */
  floatEps: number | null
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
  defaults: { timeLimitMs: number; memoryLimitMb: number; maxPoints: number },
): MentorProblemView {
  const member = toMemberProblem(problem, testcases, defaults)
  return {
    ...member,
    harness: problem.harness,
    compareMode: problem.compareMode,
    // Trước đây float_eps ghi được mà KHÔNG đọc lại được ở đâu: không nằm trong
    // SELECT nào, không nằm trong view nào. Mentor đặt dung sai rồi không có cách
    // nào xác nhận nó đã vào, và mất nó thì mọi bài so số thực tụt về mặc định
    // 1e-6 — người học làm đúng vẫn WA, không dấu hiệu nào.
    floatEps: problem.floatEps,
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
