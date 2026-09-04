/**
 * Khung TRÁI của màn soạn khoá: thông tin khoá và mô tả.
 *
 * Mentor chỉ sửa được **mô tả** — `PATCH /api/mentor/courses/:id` nhận đúng một
 * trường `descriptionMd`; mã, tên, trạng thái, tự ghi danh là quyền admin (ma trận
 * §3). Nên bốn thứ đó hiện ra ở dạng chỉ-đọc kèm một câu nói thẳng ai đổi được,
 * chứ không bị giấu đi: giấu thì mentor tưởng khoá không có mã, hoặc đi tìm ô sửa
 * tên mãi không thấy.
 */
import { Save } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { Field, Notice, TextArea } from './fields'
import type { CourseMentorRow, MentorCourseDetail } from './mentorTypes'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp',
  open: 'Đang mở',
  archived: 'Đã lưu trữ',
}

export function CourseInfoPanel({
  course,
  mentors,
  pending,
  saved,
  error,
  onSave,
}: {
  course: MentorCourseDetail
  mentors: CourseMentorRow[]
  pending: boolean
  saved: boolean
  error: string | null
  onSave: (descriptionMd: string) => void
}) {
  const descId = useId()
  const [description, setDescription] = useState(course.descriptionMd ?? '')
  const dirty = description !== (course.descriptionMd ?? '')

  return (
    <div>
      <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-xs font-semibold text-ink-3">Mã</dt>
        <dd className="font-mono text-xs text-ink-2">{course.code}</dd>
        <dt className="text-xs font-semibold text-ink-3">Tên</dt>
        <dd className="min-w-0 text-ink-2">{course.name}</dd>
        <dt className="text-xs font-semibold text-ink-3">Trạng thái</dt>
        <dd className="text-ink-2">
          {STATUS_LABEL[course.status] ?? course.status}
          {course.selfEnroll ? ' · member tự ghi danh được' : ''}
        </dd>
        <dt className="text-xs font-semibold text-ink-3">Mentor</dt>
        <dd className="min-w-0 text-ink-2">
          {mentors.length === 0 ? '—' : mentors.map((m) => m.displayName).join(', ')}
        </dd>
      </dl>

      <p className="mb-4 text-xs text-ink-5">
        Mã, tên, trạng thái và quyền tự ghi danh do admin đặt ở{' '}
        <Link to="/quan-tri/khoa-hoc" className="text-primary hover:underline">
          Quản trị · Khoá học
        </Link>
        . Ở đây bạn sửa mô tả và soạn giáo trình.
      </p>

      <Field
        id={descId}
        label="Mô tả khoá (Markdown)"
        hint="Member đọc phần này ở đầu trang khoá. Xoá hết chữ rồi lưu là xoá mô tả."
      >
        <TextArea
          id={descId}
          rows={10}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
      </Field>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {saved && !dirty ? <Notice tone="ok">Đã lưu mô tả khoá.</Notice> : null}

      <Button variant="primary" onClick={() => onSave(description)} disabled={pending || !dirty}>
        <Save size={16} /> {pending ? 'Đang lưu…' : 'Lưu mô tả'}
      </Button>
    </div>
  )
}
