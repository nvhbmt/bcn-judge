/**
 * Ai đã nộp BÀI NÀY — tab thứ ba của màn soạn bài (FR-G3).
 *
 * Mentor sửa xong một bài thì câu hỏi kế tiếp là "học viên làm ra sao": bao nhiêu
 * người qua, ai còn kẹt. Trước đó phải rời màn soạn, mở khoá, vào màn bài nộp rồi tự
 * dò từng người — mà bài tập không nhất thiết thuộc khoá nào (ngân hàng chung của CLB
 * có `scope_course_id` NULL), nên có khi không đi vòng được.
 *
 * Panel TRÁI của màn xem bài nộp: mỗi dòng một lượt, bấm thì mã nguồn hiện ở panel
 * phải. Danh sách không kèm `source` — mã của lượt đang chọn lấy bằng một lượt gọi
 * riêng, vì 200 dòng kèm mã là vài trăm KB cho một khung chỉ để liếc.
 */
import { useQuery } from '@tanstack/react-query'
import { EmptyState, Spinner, VerdictBadge } from '@/components/ui'
import { api } from '@/lib/api'
import type { Verdict } from '@/types/api'
import { cn } from '@/lib/cn'

interface Row {
  id: string
  userId: string
  displayName: string
  languageId: string
  verdict: Verdict | null
  score: number | null
  receivedAt: string | null
}

export function ProblemSubmissions({
  problemId,
  selectedId,
  onSelect,
}: {
  problemId: string
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['mentor', 'problem', problemId, 'submissions'],
    queryFn: () => api.get<Row[]>(`/api/mentor/problems/${problemId}/submissions`),
  })

  if (isLoading) return <Spinner />
  if (!data || data.length === 0) {
    return <EmptyState title="Chưa ai nộp bài này" hint="Danh sách hiện ra khi có lượt nộp đầu tiên." />
  }

  // Đếm theo NGƯỜI, không theo lượt: "12 lượt AC" có thể là một người nộp 12 lần.
  const nguoiAC = new Set(data.filter((r) => r.verdict === 'AC').map((r) => r.userId)).size
  const nguoi = new Set(data.map((r) => r.userId)).size

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="shrink-0 border-b border-line px-3.5 py-2.5 font-mono text-[12px] text-ink-5">
        {nguoi} người đã nộp · <span className="text-moss">{nguoiAC} người đạt AC</span> · {data.length} lượt
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-px bg-line">
          {data.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r.id)}
                aria-current={r.id === selectedId ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 px-3.5 py-2 text-left text-[13px] transition-colors duration-120 ease-linear',
                  r.id === selectedId ? 'bg-surface-sel shadow-[inset_2px_0_0_var(--moss)]' : 'bg-surface-2 hover:bg-surface-sel',
                )}
              >
                <span className="min-w-0 flex-1 truncate text-ink-2">{r.displayName}</span>
                <VerdictBadge tone="soft" verdict={r.verdict} />
                <span className="num w-8 shrink-0 text-right font-mono text-[12px] text-ink-4">{r.score ?? '—'}</span>
                <span className="num w-24 shrink-0 text-right font-mono text-[11px] whitespace-nowrap text-ink-6">
                  {r.receivedAt
                    ? new Date(r.receivedAt).toLocaleString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })
                    : '—'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
