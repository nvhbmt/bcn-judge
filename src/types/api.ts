/** Types mirror của API (mẫu imath: FE giữ bản sao, không import từ server). */

export type Role = 'admin' | 'mentor' | 'member'
export type Verdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'IE'
export type SubmissionStatus = 'pending' | 'running' | 'done'

export interface Me {
  id: string
  email: string
  displayName: string
  role: Role
  mustChangePassword: boolean
  /** Tên Discord đang gắn; `null` = chưa gắn. Chỉ để HIỆN — định danh là discord_id
   *  ở server, vì Discord cho đổi username. */
  discordUsername: string | null
  /** URL ảnh Discord do server dựng; `null` = dùng chữ cái đầu tên. */
  avatarUrl: string | null
}

export interface CourseSummary {
  id: string
  code: string
  name: string
  descriptionMd: string | null
  /** Một mentor của khoá (người đầu theo tên) — dòng khoá ở trang chủ nói "mentor X". */
  mentorName?: string | null
}

/** `GET /api/member/courses/:id` — bản chi tiết, có thêm mentor và ngôn ngữ của khoá. */
export interface CourseDetail extends CourseSummary {
  mentors: { displayName: string; email: string }[]
  languages: { id: string; name: string }[]
}

export interface SampleIO {
  position: number
  input: string
  expected: string | null
}

export interface ProblemView {
  id: string
  title: string
  /** 'function' = chỉ nộp một hàm; harness của mentor lo phần đọc/ghi dữ liệu. */
  kind: 'stdio' | 'function'
  statementMd: string
  inputDescMd: string | null
  outputDescMd: string | null
  constraintsMd: string | null
  examples: { input: string; output: string; explanation?: string }[]
  timeLimitMs: number
  memoryLimitMb: number
  difficulty: string | null
  tags: string[]
  /** 'exact' | 'trim' | 'float' — quyết định có bỏ qua khoảng trắng cuối dòng không. */
  compareMode: string
  allowedLanguageIds: string[] | null
  starterCode: Record<string, string>
  samples: SampleIO[]
  hiddenTestcaseCount: number
}

export interface ResultView {
  position: number
  isSample: boolean
  verdict: Verdict
  timeMs: number | null
  memoryKb: number | null
  detail: string | null
  stdout?: string | null
  stderr?: string | null
  firstDiffLine?: number | null
}

export interface SubmissionView {
  id: string
  kind: string
  problemId: string
  languageId: string
  status: SubmissionStatus
  verdict: Verdict | null
  score: number | null
  passedWeight: number | null
  totalWeight: number | null
  timeMsMax: number | null
  memoryKbMax: number | null
  compileOutput: string | null
  receivedAt: string
  finishedAt: string | null
  results?: ResultView[]
  source?: string
}

export interface LanguageOption {
  id: string
  name: string
  versionLabel: string | null
  cmMode: string | null
}

/**
 * Tên tiếng Việt của verdict — thứ HIỆN RA, không phải tooltip.
 *
 * Mã AC/WA/TLE là tiếng lóng của giới thi lập trình; người mới vào CLB không đọc được
 * chúng, mà đây đúng là chỗ họ cần hiểu ngay: bài mình vừa nộp ra sao. Mã gốc vẫn giữ
 * trong `title` để ai quen thuật ngữ vẫn tra được.
 */
export const VERDICT_LABEL: Record<Verdict, string> = {
  AC: 'Chấp nhận',
  WA: 'Sai đáp án',
  TLE: 'Quá thời gian',
  MLE: 'Quá bộ nhớ',
  RE: 'Lỗi chạy',
  CE: 'Lỗi biên dịch',
  IE: 'Lỗi hệ thống',
}

export const VERDICT_TONE: Record<Verdict, 'ac' | 'wa' | 'tle' | 'neutral'> = {
  AC: 'ac',
  WA: 'wa',
  TLE: 'tle',
  MLE: 'tle',
  RE: 'wa',
  CE: 'wa',
  IE: 'neutral',
}
