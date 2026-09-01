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
