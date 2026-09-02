/**
 * Tạo bài tập mới. Cố tình chỉ hỏi HAI thứ — tiêu đề và phạm vi — rồi nhảy thẳng
 * vào trình soạn: US-2 tính bằng "≤ 10 phút cho cả bài 10 testcase", nên bước đầu
 * không được là một form dài mà mentor phải điền hết mới thấy được cái gì.
 *
 * `POST /api/mentor/problems` bắt buộc `statementMd` khác rỗng, nên bài mới nhận
 * một khung đề mẫu. Đó là mẫu để sửa đè, không phải chỗ giữ chỗ — nó đã có sẵn
 * đúng bố cục FR-D1 mà khung xem trước bên phải mong đợi.
 */
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, SectionRule } from '@/components/ui'
import { api, ApiFailure } from '@/lib/api'
import { Field, Notice, Select, TextInput } from './fields'
import type { MentorCourseRow } from './types'

const STATEMENT_TEMPLATE = [
  'Viết đề bài ở đây.',
  '',
  '**Ví dụ**',
  '',
  '```',
  '2 3',
  '```',
  '',
  '```',
  '5',
  '```',
].join('\n')

export function NewProblemForm({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [scopeCourseId, setScopeCourseId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: courses } = useQuery({
    queryKey: ['mentor', 'courses'],
    queryFn: () => api.get<MentorCourseRow[]>('/api/mentor/courses'),
  })

  const create = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>('/api/mentor/problems', {
        title: title.trim(),
        statementMd: STATEMENT_TEMPLATE,
        ...(scopeCourseId ? { scopeCourseId } : {}),
      }),
    onSuccess: ({ id }) => navigate(`/mentor/bai-tap/${id}`),
    onError: (err) => setError(err instanceof ApiFailure ? err.error.message : 'Không tạo được bài tập.'),
  })

  const submit = () => {
    if (title.trim().length === 0) {
      setError('Tiêu đề không được để trống.')
      return
    }
    setError(null)
    create.mutate()
  }

  return (
    <div className="mb-4 border border-line bg-surface-2 p-4">
      <div className="mb-3"><SectionRule label="Bài tập mới" /></div>

      <Field id="new-title" label="Tiêu đề">
        <TextInput
          id="new-title"
          value={title}
          maxLength={200}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
      </Field>

      <Field
        id="new-scope"
        label="Phạm vi"
        hint="Để ở ngân hàng chung thì chỉ bạn và admin sửa được. Gắn vào một khoá thì mọi mentor của khoá đó sửa được."
      >
        <Select
          id="new-scope"
          value={scopeCourseId}
          aria-describedby="new-scope-hint"
          onChange={(e) => setScopeCourseId(e.target.value)}
        >
          <option value="">Ngân hàng chung của câu lạc bộ</option>
          {(courses ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </Select>
      </Field>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="mt-3 flex gap-2">
        <Button variant="primary" onClick={submit} disabled={create.isPending}>
          {create.isPending ? 'Đang tạo…' : 'Tạo và soạn'}
        </Button>
        <Button onClick={onCancel} disabled={create.isPending}>
          Huỷ
        </Button>
      </div>
    </div>
  )
}
