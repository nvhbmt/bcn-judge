/** Form contest dùng chung cho tạo mới và sửa (FR-I1/I2/I8/I10). */
import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui'
import { Field, Notice, Select, TextArea, TextInput } from './fields'
import { toCreateBody, toUpdateBody, validateContest, type ContestFormValues } from './contestFormValues'
import type { MentorCourseRow } from './types'
import type { ContestBody } from './useContests'

export function ContestForm({
  mode,
  initial,
  courses,
  canPickClub,
  pending,
  onSubmit,
}: {
  mode: 'create' | 'edit'
  initial: ContestFormValues
  courses: MentorCourseRow[]
  /** me.role === 'admin' — chỉ admin đặt được contest toàn CLB (courseId = null). */
  canPickClub: boolean
  pending: boolean
  onSubmit: (body: ContestBody) => void
}) {
  const ids = {
    title: useId(),
    course: useId(),
    start: useId(),
    end: useId(),
    freeze: useId(),
    desc: useId(),
    seq: useId(),
  }
  const [values, setValues] = useState(initial)
  const [sequentialTouched, setSequentialTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof ContestFormValues>(key: K, value: ContestFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const problem = validateContest(values)
    if (problem) return setError(problem)
    // Chặn sớm cái server sẽ trả 403, để mentor thấy lý do bằng tiếng người thay vì
    // "Không có quyền thực hiện." sau một vòng mạng.
    if (values.courseId === null && !canPickClub) {
      return setError('Chọn một khoá học — chỉ admin tạo được contest toàn câu lạc bộ.')
    }
    setError(null)
    onSubmit(
      mode === 'create' ? toCreateBody(values) : toUpdateBody(initial, values, { sequentialTouched }),
    )
  }

  return (
    <form onSubmit={submit} className="border border-line bg-surface-2 p-4">
      <Field id={ids.title} label="Tên contest">
        <TextInput
          id={ids.title}
          value={values.title}
          maxLength={200}
          required
          placeholder="Contest tuần 12"
          onChange={(e) => set('title', e.currentTarget.value)}
        />
      </Field>

      <Field
        id={ids.course}
        label="Phạm vi"
        hint={
          mode === 'edit'
            ? 'Không đổi được sau khi tạo: câu UPDATE của server không ghi cột phạm vi.'
            : canPickClub
              ? 'Toàn câu lạc bộ = mọi member đều thấy.'
              : 'Mentor chỉ tạo được contest cho khoá mình phụ trách.'
        }
      >
        <Select
          id={ids.course}
          value={values.courseId ?? ''}
          disabled={mode === 'edit'}
          aria-describedby={`${ids.course}-hint`}
          onChange={(e) => set('courseId', e.currentTarget.value === '' ? null : e.currentTarget.value)}
        >
          <option value="">{canPickClub ? 'Toàn câu lạc bộ' : '— Chọn khoá —'}</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field id={ids.start} label="Bắt đầu">
          <TextInput
            id={ids.start}
            type="datetime-local"
            value={values.startAt}
            required
            onChange={(e) => set('startAt', e.currentTarget.value)}
          />
        </Field>
        <Field id={ids.end} label="Kết thúc">
          <TextInput
            id={ids.end}
            type="datetime-local"
            value={values.endAt}
            required
            onChange={(e) => set('endAt', e.currentTarget.value)}
          />
        </Field>
      </div>

      <Field id={ids.freeze} label="Đóng băng bảng xếp hạng (phút cuối)" hint="0 = không đóng băng.">
        <TextInput
          id={ids.freeze}
          type="number"
          min={0}
          max={600}
          value={values.freezeMinutes}
          aria-describedby={`${ids.freeze}-hint`}
          onChange={(e) => set('freezeMinutes', e.currentTarget.value)}
        />
      </Field>

      <Field
        id={ids.desc}
        label="Mô tả (Markdown)"
        hint={mode === 'edit' ? 'Xoá hết chữ rồi lưu là xoá mô tả của contest.' : undefined}
      >
        <TextArea
          id={ids.desc}
          rows={4}
          value={values.descriptionMd}
          aria-describedby={mode === 'edit' ? `${ids.desc}-hint` : undefined}
          onChange={(e) => set('descriptionMd', e.currentTarget.value)}
        />
      </Field>

      <div className="mb-3">
        <label htmlFor={ids.seq} className="flex items-center gap-2 text-sm">
          <input
            id={ids.seq}
            type="checkbox"
            className="size-4"
            checked={values.sequential}
            aria-describedby={`${ids.seq}-hint`}
            onChange={(e) => {
              setSequentialTouched(true)
              set('sequential', e.currentTarget.checked)
            }}
          />
          Chuỗi tuần tự — phải AC bài trước mới mở bài sau
        </label>
        {mode === 'edit' ? (
          <p id={`${ids.seq}-hint`} className="mt-1 text-xs text-ink-5">
            Đang hiện đúng trạng thái của contest.
          </p>
        ) : null}
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="mt-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Đang lưu…' : mode === 'create' ? 'Tạo contest (nháp)' : 'Lưu thay đổi'}
        </Button>
      </div>
    </form>
  )
}
