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
import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, EmptyState, SectionRule, Spinner } from '@/components/ui'
import { RowGroup, RowHead, StatStrip } from '@/components/ui/patterns'
import { api } from '@/lib/api'
import { NewProblemForm } from './NewProblemForm'
import { PROBLEM_COLS, ProblemRow } from './ProblemRow'
import { isValidated, type MentorCourseRow, type MentorProblemRow } from './types'

export function ProblemListPage() {
  const [creating, setCreating] = useState(false)
  const [tim, setTim] = useState('')
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

  // Lọc ở CLIENT vì cả danh sách đã tải sẵn — không thêm endpoint nào, và mentor
  // không phải chờ một vòng mạng cho mỗi ký tự gõ. Khớp cả tiêu đề lẫn tag, bỏ dấu
  // hoa/thường, vì mentor nhớ bài theo chủ đề nhiều như nhớ theo tên.
  const all = useMemo(() => data ?? [], [data])
  const rows = useMemo(() => {
    const q = tim.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (r) => r.title.toLowerCase().includes(q) || (r.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    )
  }, [all, tim])

  // Dải số liệu đếm trên TOÀN BỘ danh sách, không theo bộ lọc: nó trả lời "kho bài
  // đang thế nào", mà con số đó không được đổi theo chuỗi vừa gõ vào ô tìm.
  const khongTest = all.filter((r) => r.testcases === 0).length
  const daKiem = all.filter((r) => r.testcases > 0 && isValidated(r)).length
  const chuaKiem = all.length - daKiem - khongTest

  return (
    <div className="mx-auto h-full w-full max-w-6xl overflow-y-auto px-7 py-8">
      <header className="mb-6 flex items-start justify-between gap-5">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] text-ink-1">Bài tập</h1>
          <p className="mt-1.5 text-[14px] text-ink-4">
            Soạn đề, tải test lên, kiểm bằng lời giải mẫu, xong mới cho member thấy.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <label className="flex items-center gap-2 border border-line-strong px-2.5 py-2 focus-within:border-moss">
            <Search size={14} aria-hidden className="shrink-0 text-ink-6" />
            <input
              value={tim}
              onChange={(e) => setTim(e.target.value)}
              placeholder="tìm bài"
              aria-label="Tìm bài tập theo tiêu đề hoặc tag"
              className="w-32 bg-transparent font-mono text-[12px] text-ink-2 outline-none placeholder:text-ink-6"
            />
          </label>
          {!creating ? (
            <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
              <Plus size={15} /> Bài tập mới
            </Button>
          ) : null}
        </div>
      </header>

      {all.length > 0 ? (
        <StatStrip
          items={[
            { label: 'Tổng số bài', value: all.length },
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

      {all.length > 0 ? (
        <section className="mt-8">
          <SectionRule
            label={tim ? 'Kết quả tìm' : 'Tất cả bài tập'}
            meta={tim ? `${rows.length}/${all.length} bài` : `${all.length} bài`}
          />
          <div className="mt-3">
            <RowHead cols={PROBLEM_COLS}>
              <span>tiêu đề</span>
              <span>trạng thái kiểm</span>
              <span>độ khó</span>
              <span>khoá</span>
              <span>testcase</span>
              <span className="text-right">sửa lần cuối</span>
            </RowHead>
            {rows.length === 0 ? (
              <EmptyState title={`Không có bài nào khớp “${tim}”`} hint="Thử một từ khác, hoặc xoá ô tìm." />
            ) : (
              <RowGroup className="mt-px border-t-0">
                {rows.map((row) => (
                  <ProblemRow key={row.id} row={row} courseCode={courseCode(row.scopeCourseId)} />
                ))}
              </RowGroup>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}
