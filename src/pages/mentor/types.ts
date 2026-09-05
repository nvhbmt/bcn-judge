/**
 * Bản sao kiểu của API mentor (mẫu `src/types/api.ts`: FE giữ bản sao, không import
 * từ server).
 *
 * Cả hai endpoint của `server/src/routes/mentor/problems.ts` đều alias đầy đủ và
 * trả **camelCase**.
 *
 * Chú thích cũ ở đây từng ghi rằng `GET /api/mentor/problems` trả snake_case. Điều
 * đó đúng vào lúc viết, rồi route được sửa cho khớp `GET /:id` mà bản sao kiểu này
 * không đổi theo — nên FE đọc `row.updated_at`, `row.testcase_rev`,
 * `row.validated_testcase_rev`, `row.scope_course_id` và nhận `undefined` hết.
 * TypeScript không bắt được vì kiểu ở đây tự khai snake_case: bản sao kiểu sai thì
 * nó hợp thức hoá chính cái sai đó. Hậu quả trên màn hình: ngày thành "Invalid
 * Date", số bộ test biến mất, bài của ngân hàng chung bị gán nhầm "Khoá khác", và
 * nặng nhất là MỌI bài đều đeo huy hiệu xanh "Đã kiểm" (xem `isValidated` bên dưới).
 */
import type { SubmissionStatus, Verdict } from '@/types/api'


export type Difficulty = 'easy' | 'medium' | 'hard'
export type ProblemKind = 'stdio' | 'function'
export type CompareMode = 'trim' | 'exact' | 'float'
export type TestcaseKind = 'sample' | 'hidden'

/** Một dòng của `GET /api/mentor/problems`. */
export interface MentorProblemRow {
  id: string
  title: string
  scopeCourseId: string | null
  difficulty: string | null
  tags: string[] | null
  testcaseRev: number
  validatedTestcaseRev: number | null
  updatedAt: string
  testcases: number
}

/** Testcase như mentor thấy: chỉ **2 KB đầu** (PREVIEW_BYTES của serialize/problem.ts). */
export interface MentorTestcaseView {
  id: string
  position: number
  kind: string
  weight: number
  inputPreview: string
  expectedPreview: string | null
  inputBytes: number
  expectedBytes: number | null
}

/** `GET /api/mentor/problems/:id` → `toMentorProblem()`. */
export interface MentorProblemDetail {
  id: string
  title: string
  kind: ProblemKind
  /** {languageId: harness} — chỉ có ở đường mentor, không bao giờ sang member. */
  harness: Record<string, string>
  statementMd: string
  inputDescMd: string | null
  outputDescMd: string | null
  constraintsMd: string | null
  /** Giới hạn đã GIẢI QUYẾT: server trả mặc định hệ thống khi bài để trống. */
  timeLimitMs: number
  memoryLimitMb: number
  difficulty: string | null
  tags: string[]
  allowedLanguageIds: string[] | null
  compareMode: string
  /** Dung sai khi compareMode = 'float'; null = mặc định 1e-6 của máy chấm. */
  floatEps: number | null
  /** {languageId: code} — nạp sẵn vào editor của member khi mở bài. */
  starterCode: Record<string, string>
  testcaseRev: number
  solutionLanguageId: string | null
  solutionSource: string | null
  solutionVisibility: string
  hiddenTestcaseCount: number
  testcases: MentorTestcaseView[]
}

/**
 * `GET /api/mentor/problems/:id/validate/:submissionId` — kết quả một lượt kiểm,
 * qua serializer MENTOR.
 *
 * Khác đường `/api/member/submissions/:id` ở đúng một điểm, và điểm đó là lý do
 * route này tồn tại: serializer member tước stdout/diff của testcase ẨN (NFR-2), nên
 * đọc qua đó thì "testcase 7 WA" không kèm được bằng chứng nào — đúng tiêu chí US-2
 * mà FR-D6 đòi. `mentorStdout` là bản sao riêng cho mentor, có ở MỌI testcase.
 */
export interface ValidateResultView {
  position: number
  isSample: boolean
  verdict: Verdict
  timeMs: number | null
  memoryKb: number | null
  exitCode: number | null
  termSignal: number | null
  detail: string | null
  stdout: string | null
  stderr: string | null
  /** Output thật của lời giải mẫu, kể cả testcase ẩn. */
  mentorStdout: string | null
  firstDiffLine: number | null
}

export interface ValidateRunView {
  id: string
  status: SubmissionStatus
  verdict: Verdict | null
  compileOutput: string | null
  results: ValidateResultView[]
}

/** `meta` của `GET /api/mentor/problems/:id` (FR-D6). */
export interface ProblemDetailMeta {
  validated?: boolean
  validatedAt?: string | null
}

/** `GET /api/mentor/courses` — dùng để đặt phạm vi bài và hiện mã khoá ở danh sách. */
export interface MentorCourseRow {
  id: string
  code: string
  name: string
  status: string
}

export const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Dễ',
  medium: 'Trung bình',
  hard: 'Khó',
}

export const COMPARE_MODE_LABEL: Record<CompareMode, string> = {
  trim: 'Bỏ khoảng trắng thừa (mặc định)',
  exact: 'Khớp tuyệt đối từng byte',
  float: 'So sánh số thực có sai số',
}

/**
 * FR-D6: "đã kiểm" nghĩa là lần kiểm gần nhất chạy trên ĐÚNG bộ test hiện tại.
 * `PUT`/zip đều bump `testcaseRev`, nên mọi lần đổi testcase tự đẩy bài về "chưa kiểm"
 * — không cần ai nhớ bấm gì.
 *
 * So sánh bằng `typeof === 'number'` chứ không phải `!== null`: bản trước dùng
 * `!== null`, nên khi hai trường về `undefined` (tên trường lệch với API) thì
 * `undefined !== null` là true và `undefined === undefined` cũng true — hàm trả
 * true cho MỌI bài, dán nhãn "đã kiểm" lên cả bài chưa hề kiểm. Huy hiệu này là
 * thứ mentor nhìn để quyết định có publish hay không, nên nó phải sai về phía
 * "chưa kiểm" khi dữ liệu không rõ ràng.
 */
export function isValidated(row: Pick<MentorProblemRow, 'testcaseRev' | 'validatedTestcaseRev'>): boolean {
  return typeof row.validatedTestcaseRev === 'number' && row.validatedTestcaseRev === row.testcaseRev
}
