/**
 * Danh sách bài tập của mentor (FR-D1, FR-D6).
 *
 * Cột quan trọng nhất là trạng thái kiểm, không phải tiêu đề: một bài "chưa kiểm"
 * là một bài chưa xuất bản được, và đó là lý do mentor mở trang này. Trạng thái
 * suy ra từ `validatedTestcaseRev === testcaseRev` — cùng phép so sánh mà
 * `GET /:id` trả trong `meta.validated`, đặt trong `isValidated()` để hai màn hình
 * không bao giờ nói hai điều khác nhau.
 */
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { ValidationBadge, validationState } from './badges'
import { NewProblemForm } from './NewProblemForm'
import { DIFFICULTY_LABEL, isValidated, type MentorCourseRow, type MentorProblemRow } from './types'

export function ProblemListPage() {
  const [creating, setCreating] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['mentor', 'problems'],
    queryFn: () => api.get<MentorProblemRow[]>('/api/mentor/problems'),
  })
  const { data: courses } = useQuery({
    queryKey: ['mentor', 'courses'],
    queryFn: () => api.get<MentorCourseRow[]>('/api/mentor/courses'),
  })

  const courseCode = (id: string | null): string => {
    if (id === null) return 'Ngân hàng chung'
    return courses?.find((c) => c.id === id)?.code ?? 'Khoá khác'
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:underline">
        <ArrowLeft size={15} /> Khoá học của tôi
      </Link>

      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Bài tập</h1>
          <p className="text-sm text-slate-500">
            Soạn đề, nạp testcase và kiểm bằng lời giải mẫu trước khi member thấy bài.
          </p>
        </div>
        {!creating ? (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Bài tập mới
          </Button>
        ) : null}
      </header>

      {creating ? <NewProblemForm onCancel={() => setCreating(false)} /> : null}

      {isLoading ? <Spinner /> : null}
      {data && data.length === 0 && !creating ? (
        <EmptyState title="Chưa có bài tập nào" hint="Bấm “Bài tập mới” để soạn bài đầu tiên." />
      ) : null}

      <ul className="grid gap-2">
        {data?.map((row) => (
          <li key={row.id}>
            <Link
              to={`/mentor/bai-tap/${row.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:border-[var(--color-primary)] dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{row.title}</span>
                <ValidationBadge
                  state={validationState({ testcases: row.testcases, validated: isValidated(row) })}
                />
                {row.difficulty ? (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {DIFFICULTY_LABEL[row.difficulty] ?? row.difficulty}
                  </span>
                ) : null}
                <span className="ml-auto text-xs text-slate-400">
                  {new Date(row.updatedAt).toLocaleString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="font-mono">{courseCode(row.scopeCourseId)}</span>
                <span>{row.testcases} testcase</span>
                <span className="font-mono">bộ test #{row.testcaseRev}</span>
                {(row.tags ?? []).length > 0 ? <span>{(row.tags ?? []).join(' · ')}</span> : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
