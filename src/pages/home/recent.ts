/**
 * Kiểu và link cho `GET /api/member/submissions/recent` — dùng chung giữa thẻ
 * "Làm tiếp dở dang" và "Log của bạn", hai chỗ đọc CÙNG một endpoint.
 *
 * Để chung một chỗ vì đây đúng là lớp lỗi đã cắn dự án này một lần: frontend giữ
 * BẢN SAO kiểu của API, nên hai bản sao lệch nhau mà TypeScript không thấy gì sai
 * (mỗi bản đều tự nhất quán). Một định nghĩa thì không lệch được với chính nó.
 */
import type { Verdict } from '@/types/api'

export interface RecentRow {
  id: string
  verdict: Verdict | null
  status: string
  receivedAt: string
  problemTitle: string
  itemId: string | null
  courseId: string | null
  contestId: string | null
  contestProblemId: string | null
  score: number | null
}

/**
 * Đường về màn làm bài. Bài trong contest và bài trong khoá có hai route khác
 * nhau; thiếu `courseId`/`contestProblemId` thì không dựng được link nào — trả null
 * để nơi gọi hiện text trơn thay vì một link chết.
 */
export function workspaceLink(row: RecentRow): string | null {
  if (row.contestId && row.contestProblemId) return `/contest/${row.contestId}/bai/${row.contestProblemId}`
  if (row.courseId && row.itemId) return `/khoa-hoc/${row.courseId}/bai/${row.itemId}`
  if (row.contestId) return `/contest/${row.contestId}`
  return null
}

/** Giờ:phút của một mốc ISO, theo giờ máy người dùng. */
export function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
