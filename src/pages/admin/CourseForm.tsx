/** FR-B1: tạo và sửa khoá học (mã, tên, mô tả Markdown, trạng thái, tự ghi danh). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui'
import { api } from '@/lib/api'
import { describeFailure, type FailureNotice } from './conflicts'
import type { AdminCourse, CourseDetail, CoursePayload, CourseStatus } from './types'
import { Field, FailureBanner, Select, TextArea, TextInput } from './ui'

const EMPTY = { code: '', name: '', descriptionMd: '', status: 'draft' as CourseStatus, selfEnroll: false }

export function CourseForm({ course, onDone }: { course: AdminCourse | null; onDone: () => void }) {
  const client = useQueryClient()
  const [form, setForm] = useState(EMPTY)
  const [notice, setNotice] = useState<FailureNotice | null>(null)

  /*
   * `GET /api/admin/courses` KHÔNG select `description_md`, và không có route
   * `GET /api/admin/courses/:id`. Bản đầy đủ duy nhất lấy được là route mentor —
   * `isCourseStaff` cho admin đi qua vô điều kiện (auth/middleware.ts:48), nên
   * đây là lối hợp lệ chứ không phải lách quyền.
   */
  const detail = useQuery({
    queryKey: ['admin', 'course', course?.id, 'detail'],
    queryFn: () => api.get<CourseDetail>(`/api/mentor/courses/${course?.id}`),
    enabled: course !== null,
  })

  useEffect(() => {
    if (!course) return setForm(EMPTY)
    setForm({
      code: course.code,
      name: course.name,
      descriptionMd: detail.data?.descriptionMd ?? '',
      status: course.status,
      selfEnroll: course.selfEnroll,
    })
  }, [course, detail.data])

  const save = useMutation({
    mutationFn: (body: CoursePayload) =>
      course ? api.patch(`/api/admin/courses/${course.id}`, body) : api.post('/api/admin/courses', body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin', 'courses'] })
      void client.invalidateQueries({ queryKey: ['admin', 'course'] })
      setNotice(null)
      onDone()
    },
    onError: (err) => setNotice(describeFailure(err, 'Không lưu được khoá học.')),
  })

  // Khi sửa mà chưa đọc được mô tả cũ, PHẢI bỏ hẳn `descriptionMd` khỏi PATCH:
  // gửi chuỗi rỗng ở đây là xoá trắng mô tả mentor đã soạn.
  const descriptionReady = !course || detail.isSuccess

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate({
      code: form.code.trim(),
      name: form.name.trim(),
      status: form.status,
      selfEnroll: form.selfEnroll,
      ...(descriptionReady ? { descriptionMd: form.descriptionMd } : {}),
    })
  }

  return (
    <form onSubmit={submit} className="mb-5 border border-line bg-surface-2 p-4">
      <h2 className="mb-3 font-mono text-[11px] tracking-[0.14em] text-[var(--label)] uppercase">{course ? `Sửa khoá ${course.code}` : 'Tạo khoá học'}</h2>
      <FailureBanner notice={notice} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mã khoá" hint="Chỉ chữ, số và gạch. Duy nhất toàn hệ thống.">
          <TextInput
            required
            minLength={2}
            // Dấu gạch PHẢI escape. Trình duyệt biên dịch `pattern` bằng cờ `v`
            // (unicodeSets), mà ở đó `[\w-]` là lỗi cú pháp — Chrome bỏ qua luật này
            // và chỉ log ra console, nên ô mã khoá trông như có kiểm mà thật ra không
            // kiểm gì. Xem tests/htmlPattern.test.ts.
            pattern="[\w\-]+"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="font-mono"
          />
        </Field>
        <Field label="Tên khoá">
          <TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Trạng thái" hint="Member chỉ thấy khoá “Đang mở” mà mình đã ghi danh.">
          <Select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as CourseStatus })}
          >
            <option value="draft">Nháp — chưa member nào thấy</option>
            <option value="open">Đang mở</option>
            <option value="archived">Lưu trữ</option>
          </Select>
        </Field>
        <Field label="Tự ghi danh">
          <label className="flex items-center gap-2 py-1.5 text-sm">
            <input
              type="checkbox"
              checked={form.selfEnroll}
              onChange={(e) => setForm({ ...form, selfEnroll: e.target.checked })}
              className="size-4"
            />
            Cho phép member tự ghi danh
          </label>
        </Field>
      </div>

      <div className="mt-3">
        <Field
          label="Mô tả (Markdown)"
          hint={
            course && detail.isError
              ? 'Không đọc được mô tả hiện tại — lưu lần này sẽ GIỮ NGUYÊN mô tả cũ, không ghi đè.'
              : undefined
          }
        >
          <TextArea
            rows={5}
            value={form.descriptionMd}
            disabled={course !== null && !descriptionReady}
            onChange={(e) => setForm({ ...form, descriptionMd: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          {save.isPending ? 'Đang lưu…' : course ? 'Lưu thay đổi' : 'Tạo khoá'}
        </Button>
        <Button type="button" onClick={onDone}>
          Huỷ
        </Button>
      </div>
    </form>
  )
}
