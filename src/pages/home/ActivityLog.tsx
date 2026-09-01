/**
 * "Log của bạn" — cột phải của trang chủ (màn 02).
 *
 * Dòng thời gian ngắn, mỗi dòng là một lần nộp. Giờ và verdict dùng mono để hai
 * cột thẳng hàng; tên bài dùng sans vì nó là câu chữ.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { SectionRule, VerdictBadge } from '@/components/ui'
import { api } from '@/lib/api'
import type { Verdict } from '@/types/api'

interface RecentRow {
  id: string
  verdict: Verdict | null
  status: string
  receivedAt: string
  problemTitle: string
  itemId: string | null
  contestId: string | null
  score: number | null
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

/** Bài nộp trong contest mở về trang contest; bài trong khoá mở thẳng màn làm bài. */
function linkFor(row: RecentRow): string | null {
  if (row.contestId) return `/contest/${row.contestId}`
  return null
}

export function ActivityLog() {
  const { data } = useQuery({
    queryKey: ['member', 'recent'],
    queryFn: () => api.get<RecentRow[]>('/api/member/submissions/recent?limit=6'),
  })

  return (
    <section>
      <SectionRule label="Log của bạn" />
      {data && data.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-5">Chưa nộp bài nào.</p>
      ) : null}
      <ul className="mt-3 grid gap-2">
        {(data ?? []).map((row) => {
          const href = linkFor(row)
          const body = (
            <>
              <span className="num shrink-0 font-mono text-[11px] text-ink-6">{hhmm(row.receivedAt)}</span>
              <VerdictBadge verdict={row.verdict} pending={row.status !== 'done'} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-3">{row.problemTitle}</span>
            </>
          )
          return (
            <li key={row.id}>
              {href ? (
                <Link to={href} className="flex items-center gap-2.5 transition-colors duration-[120ms] ease-linear hover:bg-surface-sel">
                  {body}
                </Link>
              ) : (
                <span className="flex items-center gap-2.5">{body}</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
