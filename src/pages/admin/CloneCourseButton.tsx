/**
 * Nhân bản một khoá (FR-B6) — dùng để mở lại khoá cho kỳ sau.
 *
 * Hỏi mã và tên MỚI ngay tại chỗ thay vì nhân bản luôn rồi bắt đi sửa: `courses.code`
 * là duy nhất, nên "tự đặt tạm rồi sửa sau" hoặc là đụng mã đã có, hoặc là đẻ ra một
 * mã rác mà người ta quên đổi. Hỏi trước thì bản sao ra đời đã đúng tên.
 *
 * Bản sao mang theo chương, mục, bài và testcase; KHÔNG mang ghi danh và bài nộp, và
 * luôn ở trạng thái nháp — server quyết định điều đó, đây chỉ nói lại cho người dùng.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import { api, ApiFailure } from '@/lib/api'
import type { AdminCourse } from './types'
import { Field, TextInput } from './ui'

export function CloneCourseButton({ course }: { course: AdminCourse }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [mo, setMo] = useState(false)
  const [code, setCode] = useState(`${course.code}-2`)
  const [name, setName] = useState(`${course.name} (bản sao)`)
  const [loi, setLoi] = useState<string | null>(null)

  const chay = useMutation({
    mutationFn: () => api.post<{ id: string }>(`/api/admin/courses/${course.id}/clone`, { code, name }),
    onSuccess: (data) => {
      void client.invalidateQueries({ queryKey: ['admin', 'courses'] })
      navigate(`/mentor/khoa-hoc/${data.id}/thong-tin`)
    },
    onError: (err) => setLoi(err instanceof ApiFailure ? err.error.message : 'Không nhân bản được.'),
  })

  if (!mo) {
    return (
      <Button size="sm" onClick={() => setMo(true)}>
        <Copy size={14} /> Nhân bản
      </Button>
    )
  }

  return (
    <form
      className="w-full border-t border-line pt-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (code.trim() && name.trim()) chay.mutate()
      }}
    >
      <p className="mb-2 text-xs text-ink-5">
        Bản sao gồm chương, mục, bài tập và testcase. Không gồm ghi danh và bài nộp; khoá mới ở trạng thái nháp.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-32 flex-1">
          <Field label="Mã khoá mới">
            <TextInput value={code} onChange={(e) => setCode(e.target.value)} required maxLength={40} />
          </Field>
        </div>
        <div className="min-w-48 flex-2">
          <Field label="Tên khoá mới">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
          </Field>
        </div>
        <Button type="submit" variant="primary" disabled={chay.isPending}>
          {chay.isPending ? 'Đang chép…' : 'Nhân bản'}
        </Button>
        <Button onClick={() => setMo(false)}>Thôi</Button>
      </div>
      {loi ? (
        <p role="alert" className="mt-2 text-sm text-wa">
          {loi}
        </p>
      ) : null}
    </form>
  )
}
