/**
 * "Log của bạn" — cột phải của trang chủ (màn 02).
 *
 * Ba cột thẳng hàng: giờ · verdict · tên bài. Verdict ở đây là CHỮ MÀU trong một ô
 * rộng cố định 34px, không phải `VerdictBadge` có viền: bản vẽ để badge cho những
 * chỗ verdict là thông tin chính, còn ở đây nó là một cột trong dòng thời gian —
 * năm cái badge xếp dọc thành một hàng rào, đọc mệt hơn hẳn.
 *
 * Giờ và verdict dùng mono để hai cột không so le; tên bài dùng sans vì nó là câu chữ.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { SidePanel } from '@/components/ui/patterns'
import { api } from '@/lib/api'
import { VERDICT_TONE, type Verdict } from '@/types/api'
import { hhmm, workspaceLink, type RecentRow } from './recent'
import { cn } from '@/lib/cn'

const TONE_CLASS: Record<string, string> = {
  ac: 'text-moss',
  wa: 'text-clay',
  tle: 'text-earth',
  neutral: 'text-ink-4',
}

function verdictClass(verdict: Verdict | null): string {
  if (!verdict) return 'text-ink-6'
  return TONE_CLASS[VERDICT_TONE[verdict] ?? 'neutral'] ?? 'text-ink-4'
}

export function ActivityLog() {
  const { data } = useQuery({
    queryKey: ['member', 'recent'],
    queryFn: () => api.get<RecentRow[]>('/api/member/submissions/recent?limit=12'),
  })

  return (
    <SidePanel label="Log của bạn">
      {data && data.length === 0 ? <p className="text-[13px] text-ink-5">Chưa nộp bài nào.</p> : null}

      <ul className="flex flex-col gap-2.5">
        {(data ?? []).slice(0, 5).map((row) => {
          const href = workspaceLink(row)
          const body = (
            <>
              <span className="num shrink-0 font-mono text-[13px] text-ink-5">{hhmm(row.receivedAt)}</span>
              <span className={cn('num w-8.5 shrink-0 font-mono text-[13px]', verdictClass(row.verdict))}>
                {row.status === 'done' ? (row.verdict ?? '—') : '…'}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-4">{row.problemTitle}</span>
            </>
          )
          return (
            <li key={row.id}>
              {href ? (
                <Link
                  to={href}
                  className="flex items-baseline gap-2.5 transition-colors duration-120 ease-linear hover:text-ink-1"
                >
                  {body}
                </Link>
              ) : (
                <span className="flex items-baseline gap-2.5">{body}</span>
              )}
            </li>
          )
        })}
      </ul>
    </SidePanel>
  )
}
