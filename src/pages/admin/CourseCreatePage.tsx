/**
 * `/quan-tri/khoa-hoc/moi` — tạo khoá. Chỉ admin.
 *
 * Tách khỏi màn SỬA khoá (`/mentor/khoa-hoc/:id`) vì hai việc khác nhau thật: tạo là
 * một biểu mẫu ngắn chỉ admin làm được, còn sửa là bốn phần có tab và cả mentor cũng
 * vào. Nhét "tạo" thành một tab thì tab đó rỗng nghĩa với mọi khoá đã tồn tại.
 */
import { useNavigate } from 'react-router-dom'
import { AdminShell } from './AdminShell'
import { CourseForm } from './CourseForm'

const BACK = { to: '/quan-tri/khoa-hoc', label: 'Danh sách khoá học' }

export function AdminCourseCreatePage() {
  const navigate = useNavigate()
  return (
    <AdminShell
      back={BACK}
      title="Tạo khoá học"
      description="Khoá mới nên để ở trạng thái Nháp cho tới khi có nội dung."
    >
      <CourseForm course={null} onDone={() => navigate(BACK.to)} />
    </AdminShell>
  )
}
