/**
 * Màn 07 của bản v2 — danh sách bài tập của mentor (FR-D1, FR-D6).
 *
 * Cột quan trọng nhất là trạng thái kiểm, không phải tiêu đề: một bài "chưa kiểm"
 * là một bài chưa xuất bản được, và đó là lý do mentor mở trang này. Trạng thái
 * suy ra từ `validatedTestcaseRev === testcaseRev` — cùng phép so sánh mà
 * `GET /:id` trả trong `meta.validated`, đặt trong `isValidated()` để hai màn hình
 * không bao giờ nói hai điều khác nhau.
 *
 * Dải bốn số ở đầu trang trả lời đúng câu hỏi mentor mang tới: còn bao nhiêu bài
 * đang kẹt, và kẹt vì thiếu kiểm hay vì chưa có test.
 */
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button, EmptyState, SectionRule, Spinner } from '@/components/ui'
import { RowGroup, StatStrip } from '@/components/ui/patterns'
import { api } from '@/lib/api'
import { NewProblemForm } from './NewProblemForm'
import { ProblemRow } from './ProblemRow'
import { isValidated, type MentorCourseRow, type MentorProblemRow } from './types'

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
    if (id === null) return 'chung'
    return courses?.find((c) => c.id === id)?.code ?? 'khoá khác'
  }

  const rows = data ?? []
  const khongTest = rows.filter((r) => r.testcases === 0).length
  const daKiem = rows.filter((r) => r.testcases > 0 && isValidated(r)).length
  const chuaKiem = rows.length - daKiem - khongTest

  return (
    <div className="mx-auto min-h-0 w-full max-w-6xl overflow-y-auto px-7 py-8">
      <header className="mb-6 flex items-start justify-between gap-5">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] text-ink-1">Bài tập</h1>
          <p className="mt-1.5 text-[14px] text-ink-4">
            Soạn đề, tải test lên, kiểm bằng lời giải mẫu, xong mới cho member thấy.
          </p>
        </div>
        {!creating ? (
          <Button variant="primary" size="lg" onClick={() => setCreating(true)} className="shrink-0">
            <Plus size={15} /> Bài tập mới
          </Button>
        ) : null}
      </header>

      {rows.length > 0 ? (
        <StatStrip
          items={[
            { label: 'Tổng số bài', value: rows.length },
            { label: 'Đã kiểm', value: daKiem, tone: 'moss' },
            { label: 'Chưa kiểm', value: chuaKiem, tone: chuaKiem > 0 ? 'earth' : undefined },
            { label: 'Chưa có testcase', value: khongTest, tone: khongTest > 0 ? 'clay' : undefined },
          ]}
        />
      ) : null}

      {creating ? (
        <div className="mt-6">
          <NewProblemForm onCancel={() => setCreating(false)} />
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-6">
          <Spinner />
        </div>
      ) : null}
      {data && data.length === 0 && !creating ? (
        <EmptyState title="Chưa có bài tập nào" hint="Bấm “Bài tập mới” để soạn bài đầu tiên." />
      ) : null}

      {rows.length > 0 ? (
        <section className="mt-8">
          <SectionRule label="Tất cả bài tập" meta={`${rows.length} bài`} />
          <RowGroup className="mt-3">
            {rows.map((row) => (
              <ProblemRow key={row.id} row={row} courseCode={courseCode(row.scopeCourseId)} />
            ))}
          </RowGroup>
        </section>
      ) : null}
    </div>
  )
}
