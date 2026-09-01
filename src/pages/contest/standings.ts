/**
 * Kiểu bảng xếp hạng contest — dùng chung giữa bảng và dải "Điểm của bạn".
 *
 * `problems` là bản đồ theo NHÃN bài (A, B, C…), đúng thứ máy chủ trả về; nhờ vậy
 * bảng dựng được một cột cho mỗi bài như bản vẽ màn 05, thay vì chỉ một cột tổng.
 * Bản trước bỏ qua trường này nên mất hẳn cách nhìn "ai làm được bài nào".
 */
export interface ContestStandingRow {
  rank: number
  userId: string
  displayName: string
  totalPoints: number
  acCount: number
  lastGain: string | null
  problems: Record<string, { points: number; verdict: string; attempts: number }>
  isMe: boolean
}

/** Tổng số lần nộp của một người trong contest, cộng từ mọi bài. */
export function attemptsOf(row: ContestStandingRow): number {
  return Object.values(row.problems).reduce((sum, p) => sum + p.attempts, 0)
}
