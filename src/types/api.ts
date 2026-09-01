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
}

export interface CourseSummary {
  id: string
  code: string
  name: string
  descriptionMd: string | null
}

export interface SampleIO {
  position: number
  input: string
  expected: string | null
}

export interface ProblemView {
  id: string
  title: string
  statementMd: string
  inputDescMd: string | null
  outputDescMd: string | null
  constraintsMd: string | null
  examples: { input: string; output: string; explanation?: string }[]
  timeLimitMs: number
  memoryLimitMb: number
  difficulty: string | null
  tags: string[]
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

export const VERDICT_LABEL: Record<Verdict, string> = {
  AC: 'Đúng',
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
