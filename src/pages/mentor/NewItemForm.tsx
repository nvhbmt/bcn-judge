/** Thêm mục vào chương: bài đọc (Markdown) hoặc mục bài tập trỏ vào ngân hàng bài. */
import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui'
import { Field, Select, TextArea, TextInput } from './fields'
import type { ItemKind } from './mentorTypes'
import { isValidated, type MentorProblemRow } from './types'
import type { NewItemBody } from './useCourseContent'

/** Nhãn option gói luôn tình trạng FR-D6: mentor thấy "chưa kiểm" NGAY LÚC CHỌN,
 *  thay vì mãi tới lúc bấm Xuất bản mới ăn 409. */
function problemLabel(p: MentorProblemRow): string {
  const state = p.testcases === 0 ? 'chưa có testcase' : isValidated(p) ? 'đã kiểm' : 'chưa kiểm'
  return `${p.title} — ${p.testcases} testcase, ${state}`
}

export function NewItemForm({
  sectionId,
  problems,
  pending,
  onCreate,
  onCancel,
}: {
  sectionId: string
  problems: MentorProblemRow[]
  pending: boolean
  onCreate: (body: NewItemBody) => void
  onCancel: () => void
}) {
  const kindId = useId()
  const titleId = useId()
  const bodyId = useId()
  const problemFieldId = useId()
  const [kind, setKind] = useState<ItemKind>('lesson')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [problemId, setProblemId] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    // Server bắt XOR: bài đọc KHÔNG được kèm problemId, mục bài tập BẮT BUỘC có.
    // Union NewItemBody ép nhánh này viết đúng ngay từ lúc biên dịch.
    if (kind === 'lesson') {
      onCreate({ sectionId, kind: 'lesson', title: t, ...(body.trim() ? { lessonBodyMd: body } : {}) })
    } else if (problemId) {
      onCreate({ sectionId, kind: 'problem', title: t, problemId })
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 rounded-md bg-slate-50 p-3 dark:bg-slate-800/50">
      <Field id={kindId} label="Loại mục">
        <Select id={kindId} value={kind} onChange={(e) => setKind(e.currentTarget.value as ItemKind)}>
          <option value="lesson">Bài đọc</option>
          <option value="problem">Bài tập</option>
        </Select>
      </Field>

      {kind === 'problem' ? (
        <Field
          id={problemFieldId}
          label="Bài tập từ ngân hàng"
          hint="Chỉ bài đã có testcase và đã kiểm bằng lời giải mẫu mới xuất bản được suôn sẻ (FR-D6)."
        >
          <Select
            id={problemFieldId}
            value={problemId}
            required
            aria-describedby={`${problemFieldId}-hint`}
            onChange={(e) => {
              const id = e.currentTarget.value
              setProblemId(id)
              // Tên mục mặc định theo tên bài — mentor gần như luôn muốn trùng.
              const picked = problems.find((p) => p.id === id)
              if (picked && !title.trim()) setTitle(picked.title)
            }}
          >
            <option value="">— Chọn bài —</option>
            {problems.map((p) => (
              <option key={p.id} value={p.id}>
                {problemLabel(p)}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field id={titleId} label="Tên mục">
        <TextInput
          id={titleId}
          value={title}
          maxLength={200}
          required
          placeholder="Ví dụ: Bài 1 — Tổng hai số"
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
      </Field>

      {kind === 'lesson' ? (
        <Field id={bodyId} label="Nội dung bài đọc (Markdown)">
          <TextArea id={bodyId} rows={5} value={body} onChange={(e) => setBody(e.currentTarget.value)} />
        </Field>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending || !title.trim() || (kind === 'problem' && !problemId)}>
          {pending ? 'Đang thêm…' : 'Thêm mục'}
        </Button>
        <Button type="button" onClick={onCancel} disabled={pending}>
          Huỷ
        </Button>
      </div>
    </form>
  )
}
