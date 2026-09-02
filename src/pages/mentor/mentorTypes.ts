/**
 * Bản sao type cho nội dung khoá + contest (mẫu src/types/api.ts: FE giữ bản sao,
 * không import từ server để hai bên deploy độc lập).
 *
 * Phần bài tập/testcase nằm ở `./types` — đừng khai lại `MentorProblemRow` ở đây,
 * hai bản sao của cùng một endpoint chắc chắn lệch nhau sau vài lần sửa.
 */
import type { Verdict } from '@/types/api'

export type ItemKind = 'lesson' | 'problem'
export type PublishStatus = 'draft' | 'published'

export interface SyllabusItem {
  id: string
  title: string
  kind: ItemKind
  position: number
  status: PublishStatus
  problemId: string | null
}

export interface SyllabusSection {
  id: string
  title: string
  position: number
  items: SyllabusItem[]
}

export interface MentorContestRow {
  id: string
  title: string
  startAt: string
  endAt: string
  status: PublishStatus
  courseId: string | null
  freezeMinutes: number
  problemCount: number
}

/**
 * `GET /api/mentor/contests/:id` — contest KÈM danh sách bài hiện tại.
 *
 * Danh sách `/api/mentor/contests` không trả `descriptionMd`, `scoring`,
 * `penaltyMinutes`, `sequential` hay bài, nên trang sửa phải đọc ở đây. Trước đây
 * SPA tưởng route này không tồn tại và đi vòng qua danh sách — hậu quả là picker mở
 * ra rỗng trong khi PUT thay thế cả bộ, tức mở form rồi lưu là gỡ sạch bài.
 */
export interface MentorContestDetail {
  id: string
  title: string
  descriptionMd: string | null
  courseId: string | null
  startAt: string
  endAt: string
  status: PublishStatus
  scoring: string
  penaltyMinutes: number
  sequential: boolean
  freezeMinutes: number
  problems: MentorContestProblem[]
}

export interface MentorContestProblem {
  /** id của dòng contest_problems, KHÔNG phải id bài. */
  id: string
  problemId: string
  position: number
  label: string | null
  maxScore: number
  title: string
  /** Đã có người nộp — server từ chối gỡ bài này, và UI phải nói trước. */
  hasSubmissions: boolean
}

/** Một dòng của `byProblem` = một (bài × verdict). Bài chưa ai nộp vẫn có đúng
 *  một dòng với `verdict: null` do LEFT JOIN — xem groupByProblem(). */
export interface StatsRow {
  contestProblemId: string
  title: string
  verdict: Verdict | null
  n: number
}

export interface ContestStats {
  opened: number
  submitted: number
  byProblem: StatsRow[]
  notSubmitted: { id: string; displayName: string }[]
}

/**
 * Bài đang được xếp vào contest, ở dạng ĐANG SOẠN. `maxScore` giữ dạng chuỗi vì ô
 * `<input type="number">` rỗng đọc ra '': ép sang Number ngay lúc gõ thì xoá hết
 * ký tự sẽ hoá thành 0 và nhảy vào ô. Đổi sang số một lần lúc gửi.
 */
export interface ContestProblemDraft {
  problemId: string
  title: string
  label: string
  maxScore: string
}

/**
 * `GET /api/mentor/courses/:id` — route trả nguyên dòng `courses`, nên có cả những
 * cột mentor KHÔNG sửa được. Khai đủ để khung trái hiện đúng sự thật rồi nói rõ cái
 * nào chỉ-đọc, thay vì giấu đi và để mentor tưởng mình đổi được.
 */
export interface MentorCourseDetail {
  id: string
  code: string
  name: string
  descriptionMd: string | null
  status: string
  selfEnroll: boolean
  createdAt: string
  updatedAt: string
}

export interface CourseMentorRow {
  id: string
  displayName: string
  email: string
}
