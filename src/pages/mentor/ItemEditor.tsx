/** Form sửa một mục (FR-C1) — mở tại chỗ, không modal. */
import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui'
import { Field, TextArea, TextInput } from './fields'
import type { SyllabusItem } from './mentorTypes'
import type { PatchItemBody } from './useCourseContent'

export function ItemEditor({
  item,
  pending,
  onCancel,
  onSave,
}: {
  item: SyllabusItem
  pending: boolean
  onCancel: () => void
  onSave: (body: PatchItemBody) => void
}) {
  const titleId = useId()
  const bodyId = useId()
  const [title, setTitle] = useState(item.title)
  const [body, setBody] = useState('')
  const dirty = (title.trim().length > 0 && title.trim() !== item.title) || body.trim().length > 0

  function submit(e: FormEvent) {
    e.preventDefault()
    const patch: PatchItemBody = {}
    if (title.trim() && title.trim() !== item.title) patch.title = title.trim()
    // Ô trống thì BỎ HẲN khỏi payload. Server dùng
    // `COALESCE(${lessonBodyMd ?? null}, lesson_body_md)`; chuỗi rỗng không phải
    // NULL nên gửi '' là XOÁ sạch bài đọc chứ không phải "giữ nguyên".
    if (body.trim()) patch.lessonBodyMd = body
    onSave(patch)
  }

  return (
    <form onSubmit={submit} className="mt-2 rounded-md bg-slate-50 p-3 dark:bg-slate-800/50">
      <Field id={titleId} label="Tên mục">
        <TextInput
          id={titleId}
          value={title}
          maxLength={200}
          required
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
      </Field>

      {item.kind === 'lesson' ? (
        <Field
          id={bodyId}
          label="Nội dung bài đọc (Markdown)"
          hint="Để trống = giữ nguyên nội dung đang có. API syllabus không trả nội dung bài đọc về nên ô này luôn mở ra rỗng."
        >
          <TextArea
            id={bodyId}
            rows={6}
            value={body}
            aria-describedby={`${bodyId}-hint`}
            onChange={(e) => setBody(e.currentTarget.value)}
          />
        </Field>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending || !dirty}>
          {pending ? 'Đang lưu…' : 'Lưu'}
        </Button>
        <Button type="button" onClick={onCancel} disabled={pending}>
          Huỷ
        </Button>
      </div>
    </form>
  )
}
