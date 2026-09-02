/**
 * Các tab của màn sửa khoá, và AI thấy tab nào.
 *
 * Luật một câu: **thấy tab nghĩa là sửa được trong đó**. Tab chỉ-đọc bị ẩn hẳn chứ
 * không hiện ra rồi khoá — một khung đầy nút bấm không được là lời mời thử rồi ăn 403,
 * và người dùng không có cách nào biết đó là do vai của mình.
 *
 * Bảng dưới đây phải khớp ma trận quyền ở server, nếu không nó thành lời hứa suông:
 *
 *   | phần                          | admin | mentor phụ trách |
 *   |-------------------------------|-------|------------------|
 *   | mã · tên · trạng thái         | sửa   | KHÔNG            |
 *   | mô tả                         | sửa   | sửa              |
 *   | giáo trình (chương/mục)       | sửa   | sửa              |
 *   | ghi danh member               | sửa   | sửa              |
 *   | gán/gỡ mentor                 | sửa   | chỉ đọc → ẩn     |
 *
 * Hai dòng cuối là chỗ dễ đoán sai nhất: mentor ghi danh được (có POST và DELETE ở
 * `/api/mentor/courses/:id/enrollments`) nhưng KHÔNG gán được mentor
 * (`GET /:id/mentors` của mentor là chỉ đọc, gán/gỡ chỉ có bên admin).
 *
 * Giáo trình KHÔNG có tab: nó là panel PHẢI cố định, luôn hiện cạnh mọi tab. Đó là thứ
 * mentor mở màn này ra để làm, và nó cần cả bề ngang — nhét thành một tab thì sửa mô
 * tả xong muốn xem lại chương nào phải bấm qua bấm lại.
 */
export type CourseTabId = 'thong-tin' | 'ghi-danh' | 'mentor'

export interface CourseTab {
  id: CourseTabId
  label: string
  /** Câu mô tả ngắn dưới tiêu đề tab đang mở. */
  hint: string
}

const ALL: Record<CourseTabId, CourseTab> = {
  'thong-tin': { id: 'thong-tin', label: 'Thông tin', hint: 'Tên, mã, trạng thái và mô tả khoá.' },
  'ghi-danh': { id: 'ghi-danh', label: 'Ghi danh', hint: 'Thêm và gỡ member khỏi khoá.' },
  mentor: { id: 'mentor', label: 'Mentor', hint: 'Gán và gỡ mentor phụ trách khoá.' },
}

export function tabsFor(role: string | undefined): CourseTab[] {
  const ids: CourseTabId[] =
    role === 'admin'
      ? ['thong-tin', 'ghi-danh', 'mentor']
      : ['thong-tin', 'ghi-danh']
  return ids.map((id) => ALL[id])
}

/** Tab trong URL có thể là rác hoặc là tab mà vai này không thấy → về tab đầu. */
export function resolveTab(raw: string | undefined, tabs: CourseTab[]): CourseTabId {
  return tabs.find((t) => t.id === raw)?.id ?? tabs[0]!.id
}
