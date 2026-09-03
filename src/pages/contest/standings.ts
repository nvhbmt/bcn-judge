/**
 * Kiểu bảng xếp hạng contest — dùng chung giữa bảng và dải "Điểm của bạn".
 *
 * `problems` là bản đồ theo contestProblemId, đúng thứ máy chủ trả về. Bảng xếp hạng
 * KHÔNG còn dựng một cột cho mỗi bài (cột tên bị bóp còn "Phạ…" trong side column
 * hẹp — xem ContestStandings.tsx); trường này giờ chỉ còn `attemptsOf` dùng để cộng
 * tổng số lần nộp cho dải "Điểm của bạn".
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
