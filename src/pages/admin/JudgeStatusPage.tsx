/**
 * `/quan-tri` — trang tình trạng chấm (FR-H3).
 *
 * Đi qua `AdminShell` như bốn trang quản trị còn lại, nên thanh điều hướng đứng YÊN
 * khi chuyển giữa năm mục. Bản trước tự bọc thanh nav trong một khung `max-w-3xl`
 * riêng rồi mới gọi `AdminPage` (khung `max-w-5xl px-7` của chính nó) — hai bề rộng
 * lệch nhau trên đúng một trang, và cả cụm nhảy ngang mỗi lần bấm vào mục này.
 */
import { AdminPage } from '@/pages/AdminPage'
import { AdminShell } from './AdminShell'

export function AdminJudgePage() {
  return (
    <AdminShell title="Tình trạng chấm bài" description="Cập nhật mỗi 5 giây. Bài nộp chờ quá 2 phút là báo động.">
      <AdminPage />
    </AdminShell>
  )
}
