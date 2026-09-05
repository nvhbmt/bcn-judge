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

/**
 * Bài còn "dở dang" để nổi lên thẻ Làm tiếp: bài mà LẦN NỘP MỚI NHẤT của nó không
 * phải AC (và còn dựng được link về màn làm bài).
 *
 * Mấu chốt là chữ "mới nhất CỦA BÀI ĐÓ", không phải "lần nộp non-AC mới nhất nói
 * chung". `rows` xếp mới-nhất-trước (server `ORDER BY seq DESC`), nên lần ĐẦU gặp
 * một bài chính là lần nộp mới nhất của nó — chốt trạng thái dở/xong tại đó rồi bỏ
 * qua mọi lần cũ hơn của cùng bài.
 *
 * Lỗi của bản trước: duyệt từng LẦN NỘP và vớ lần non-AC đầu tiên. Nộp WA rồi nộp
 * AC cùng một bài thì danh sách là [AC, WA, …] — nó bỏ qua AC (đúng), rồi vớ WA và
 * báo "lần cuối sai", trong khi lần cuối thật sự là AC. Người dùng gặp đúng ca này.
 *
 * Khoá của một BÀI phân biệt cả ngữ cảnh: cùng đề nhưng nộp trong contest và trong
 * khoá là hai chỗ khác nhau, không được gộp. Thứ tự rơi: `contestProblemId` →
 * `itemId` → `contestId` → `id`. Bậc `contestId` KHÔNG thừa: một dòng dị dạng chỉ
 * có contestId (thiếu cả hai id bài) vẫn dựng được link `/contest/:id`, nên nếu rơi
 * thẳng xuống `id` thì mỗi lần nộp thành một "bài" riêng và LỖI GỐC quay lại — AC
 * mới nhất bị bỏ qua, WA cũ được vớ. Gộp theo contestId là chặt hơn: cùng lắm gộp
 * nhầm hai dòng dị dạng của một contest, mà trạng thái đó vốn đã hỏng sẵn.
 */
export function pickUnfinished(rows: RecentRow[]): { row: RecentRow; href: string } | null {
  const seen = new Set<string>()
  for (const row of rows) {
    const key = row.contestProblemId ?? row.itemId ?? row.contestId ?? row.id
    if (seen.has(key)) continue // đã gặp lần mới hơn của bài này — bỏ qua lần cũ
    seen.add(key)
    // Đây là lần nộp MỚI NHẤT của bài này; nó quyết định bài còn dở hay đã xong.
    if (row.status !== 'done' || row.verdict === 'AC') continue
    const href = workspaceLink(row)
    if (href) return { row, href }
  }
  return null
}

/** Giờ:phút của một mốc ISO, theo giờ máy người dùng. */
export function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
