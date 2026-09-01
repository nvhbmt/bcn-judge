/**
 * `/quan-tri` — trang tình trạng chấm (FR-H3) kèm thanh điều hướng quản trị.
 *
 * Là lớp bọc mỏng quanh `AdminPage` sẵn có thay vì sửa thẳng tệp đó: nội dung
 * trang cũ không đổi một dòng nào, chỉ được nối vào cụm quản trị. Nhờ vậy trang
 * tình trạng chấm không còn là ngõ cụt — từ đây sang được Tài khoản, Khoá học,
 * Team, Cài đặt và ngược lại.
 */
import { AdminPage } from '@/pages/AdminPage'
import { AdminNav } from './AdminShell'

export function AdminJudgePage() {
  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <AdminNav />
      </div>
      <AdminPage />
    </>
  )
}
