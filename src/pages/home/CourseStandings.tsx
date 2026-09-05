/**
 * "BXH khoá …" ở cột phải trang chủ (màn 02).
 *
 * Chỉ lấy 4 dòng đầu — đây là liếc nhanh chứ không phải bảng xếp hạng đầy đủ; bảng
 * đầy đủ nằm trong workspace (FR-G6). Dòng của CHÍNH MÌNH nổi lên bằng nền đậm hơn
 * một bậc + vạch trong 2px moss bên trái, đúng cách hệ thiết kế đánh dấu "đang chọn".
 *
 * Nếu mình không nằm trong 4 dòng đầu thì vẫn ghép dòng của mình vào cuối: một BXH
 * không cho người ta thấy chỗ đứng của chính họ thì gần như vô dụng.
 */
import { useQuery } from '@tanstack/react-query'
import { Row, RowGroup, SidePanel } from '@/components/ui/patterns'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface StandingRow {
  rank: number
  userId: string
  displayName: string
  acCount: number
  totalPoints: number
  isMe: boolean
}

const TOP = 4

export function CourseStandings({ courseId, courseCode }: { courseId: string; courseCode: string }) {
  const { data } = useQuery({
    queryKey: ['member', 'courseLeaderboard', courseId],
    queryFn: () => api.get<StandingRow[]>(`/api/member/courses/${courseId}/leaderboard`),
    // BXH khoá được phép trễ ~15 giây (NFR-4 v0.6).
    refetchInterval: 15_000,
  })

  if (!data || data.length === 0) return null

  const top = data.slice(0, TOP)
  const me = data.find((r) => r.isMe)
  const rows = me && !top.some((r) => r.isMe) ? [...top, me] : top

  return (
    <SidePanel label={`BXH khoá ${courseCode}`} flush>
      <RowGroup className="border-0">
        {rows.map((row) => (
          <Row key={row.userId} accent={row.isMe ? 'moss' : null} className="gap-3 px-2.5 py-2">
            <span className={cn('num w-5 shrink-0 font-mono text-[14px]', row.isMe ? 'text-moss' : 'text-ink-5')}>
              {row.rank}
            </span>
            <span className={cn(
              'min-w-0 flex-1 truncate text-[15px]',
              row.isMe ? 'font-semibold text-ink-1' : 'text-ink-2',
            )}>
              {row.isMe ? 'Bạn' : row.displayName}
            </span>
            <span className={cn('num font-mono text-[14px]', row.isMe ? 'text-ink-1' : 'text-ink-4')}>
              {row.totalPoints}
            </span>
          </Row>
        ))}
      </RowGroup>
    </SidePanel>
  )
}
