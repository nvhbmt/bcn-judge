import { useQuery } from '@tanstack/react-query'
import { EmptyState, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface Row {
  rank: number
  userId: string
  displayName: string
  acCount: number
  totalPoints: number
  isMe: boolean
}

/**
 * Mục "Bảng xếp hạng" của thanh icon — hiển thị THEO NGỮ CẢNH (FR-E7 v0.5):
 * trong contest là BXH contest, ngoài contest là BXH khoá (FR-G6).
 */
export function LeaderboardPanel({ courseId, contestId }: { courseId?: string; contestId?: string }) {
  const path = contestId
    ? `/api/member/contests/${contestId}/standings`
    : courseId
      ? `/api/member/courses/${courseId}/leaderboard`
      : null

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', path],
    queryFn: () => api.get<Row[]>(path!),
    enabled: path !== null,
    // BXH khoá được phép trễ ~15 giây (NFR-4 v0.6); BXH contest sống hơn.
    refetchInterval: contestId ? 5000 : 15_000,
  })

  if (!path) return <EmptyState title="Không có bảng xếp hạng ở ngữ cảnh này" />
  if (isLoading) return <div className="p-4"><Spinner /></div>
  if (!data || data.length === 0) return <EmptyState title="Chưa ai có kết quả" />

  return (
    <div className="px-2 py-3">
      <h3 className="px-2 pb-2 text-xs font-semibold tracking-wide text-ink-5 uppercase">
        {contestId ? 'Bảng xếp hạng contest' : 'Bảng xếp hạng khoá'}
      </h3>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-ink-5">
          <tr>
            <th className="px-2 py-1">#</th>
            <th>Thành viên</th>
            <th className="text-right">AC</th>
            <th className="px-2 text-right">Điểm</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.userId}
              className={cn('border-t border-line', row.isMe && 'bg-primary-soft font-medium')}
            >
              <td className="px-2 py-1.5 tabular-nums">{row.rank}</td>
              <td className="truncate">{row.displayName}</td>
              <td className="text-right tabular-nums">{row.acCount}</td>
              <td className="px-2 text-right tabular-nums">{row.totalPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
