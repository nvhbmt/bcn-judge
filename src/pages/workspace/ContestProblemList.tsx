import { Link } from 'react-router-dom'
import { EmptyState, Spinner } from '@/components/ui'
import { useContestDetail } from '@/pages/contest/useContestDetail'
import { cn } from '@/lib/cn'

/** Mục "Giáo trình" khi đang ở trong contest: danh sách bài của contest (FR-E7). */
export function ContestProblemList({ contestId, currentId }: { contestId?: string; currentId?: string }) {
  const { contest: data, isLoading } = useContestDetail(contestId)

  if (!contestId) return <EmptyState title="Không có danh sách bài ở đây" />
  if (isLoading) return <div className="p-4"><Spinner /></div>
  if (!data) return <EmptyState title="Không tìm thấy contest" />
  if (data.phase === 'sap-dien-ra') {
    return <EmptyState title="Contest chưa bắt đầu" hint="Đề sẽ mở đúng giờ, không cần tải lại trang." />
  }

  return (
    <nav className="px-2 py-3" aria-label="Bài trong contest">
      <h3 className="px-2 pb-1 text-xs font-semibold tracking-wide text-ink-5 uppercase">{data.title}</h3>
      <ul>
        {data.problems.map((p) => (
          <li key={p.id}>
            <Link
              to={`/contest/${contestId}/bai/${p.id}`}
              aria-current={p.id === currentId ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 text-sm',
                p.id === currentId ? 'bg-primary-soft font-medium' : 'hover:bg-surface-sel',
              )}
            >
              <span className="w-4 shrink-0 font-mono text-xs text-ink-5">{p.label}</span>
              <span className="truncate">{p.title}</span>
              <span className="ml-auto shrink-0 font-mono text-xs text-ink-6">{p.maxScore}đ</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
