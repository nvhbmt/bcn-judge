import { useQuery } from '@tanstack/react-query'
import { EmptyState, Spinner, VerdictBadge } from '@/components/ui'
import { api } from '@/lib/api'
import type { SubmissionView } from '@/types/api'

/**
 * Tab "Bài nộp" (FR-E3/FR-G1): CHỈ danh sách với verdict tổng — chi tiết từng
 * testcase nằm ở tab Kết quả dưới editor (FR-E5 v0.5).
 */
export function SubmissionsPanel({
  handleQuery,
  selectedId,
  onSelect,
  onLoadIntoEditor,
}: {
  handleQuery: string
  selectedId: string | null
  onSelect: (id: string) => void
  onLoadIntoEditor: (submission: SubmissionView) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['submissions', handleQuery],
    queryFn: () => api.get<SubmissionView[]>(`/api/member/submissions?${handleQuery}`),
    refetchInterval: 5000,
  })

  if (isLoading) return <div className="p-4"><Spinner /></div>
  if (!data || data.length === 0) {
    return <EmptyState title="Chưa nộp bài nào" hint="Bài nộp của bạn sẽ hiện ở đây." />
  }

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {data.map((s) => (
        <li key={s.id}>
          <div
            className={`flex items-center gap-3 px-4 py-2 text-sm ${
              s.id === selectedId ? 'bg-[var(--color-primary-soft)] dark:bg-slate-800' : ''
            }`}
          >
            <button onClick={() => onSelect(s.id)} className="flex flex-1 items-center gap-3 text-left">
              <VerdictBadge verdict={s.verdict} pending={s.status !== 'done'} />
              <span className="tabular-nums">{s.score === null ? '—' : `${s.score} đ`}</span>
              <span className="font-mono text-xs text-slate-500">{s.languageId}</span>
              <span className="ml-auto text-xs text-slate-400">{formatTime(s.receivedAt)}</span>
            </button>
            <button
              onClick={async () => onLoadIntoEditor(await api.get<SubmissionView>(`/api/member/submissions/${s.id}`))}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              Nạp lại code
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}
