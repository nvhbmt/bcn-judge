/**
 * Bản sao kiểu của API mentor (mẫu `src/types/api.ts`: FE giữ bản sao, không import
 * từ server).
 *
 * ĐỌC KỸ trước khi sửa — hai endpoint của `server/src/routes/mentor/problems.ts`
 * đặt tên trường KHÁC NHAU và đó là sự thật của API, không phải nhầm lẫn ở đây:
 *
 *   - `GET /api/mentor/problems` SELECT thẳng cột, không alias → trả **snake_case**
 *     (`scope_course_id`, `testcase_rev`, `validated_testcase_rev`, `updated_at`).
 *   - `GET /api/mentor/problems/:id` alias đầy đủ → trả **camelCase**.
 *
 * Giữ nguyên hai lối đặt tên thay vì "dọn cho đẹp" một bên: đổi tên ở FE thì người
 * sau đọc route sẽ không tìm ra trường đang hiện trên màn hình.
 */

export type Difficulty = 'easy' | 'medium' | 'hard'
export type CompareMode = 'trim' | 'exact' | 'float'
export type TestcaseKind = 'sample' | 'hidden'

/** Một dòng của `GET /api/mentor/problems` — snake_case, xem chú thích đầu file. */
export interface MentorProblemRow {
  id: string
  title: string
  scope_course_id: string | null
  difficulty: string | null
  tags: string[] | null
  testcase_rev: number
  validated_testcase_rev: number | null
  updated_at: string
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
  testcaseRev: number
  solutionLanguageId: string | null
  solutionSource: string | null
  solutionVisibility: string
  hiddenTestcaseCount: number
  testcases: MentorTestcaseView[]
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
 * `PUT`/zip đều bump `testcase_rev`, nên mọi lần đổi testcase tự đẩy bài về "chưa kiểm"
 * — không cần ai nhớ bấm gì.
 */
export function isValidated(row: Pick<MentorProblemRow, 'testcase_rev' | 'validated_testcase_rev'>): boolean {
  return row.validated_testcase_rev !== null && row.validated_testcase_rev === row.testcase_rev
}
