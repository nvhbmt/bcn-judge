/**
 * Thẻ "Làm tiếp dở dang" — khối nổi bật nhất của trang chủ (màn 02).
 *
 * Ý của thiết kế: người học mở judge lên là để làm tiếp bài hôm qua còn dở, nên thứ
 * đầu tiên trong tầm mắt phải là đúng bài đó cùng một nút mở thẳng editor — không
 * phải danh sách khoá để họ tự đi tìm.
 *
 * "Dở dang" = lần nộp gần nhất KHÔNG phải AC và còn link về màn làm bài. Bài đã AC
 * thì không còn gì để làm tiếp; bài không dựng được link thì nút sẽ dẫn đi đâu.
 * Không có bài nào như vậy thì thẻ biến mất hẳn, không hiện khung rỗng.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { workspaceLink, type RecentRow } from './recent'

function pickUnfinished(rows: RecentRow[]): { row: RecentRow; href: string } | null {
  for (const row of rows) {
    if (row.status !== 'done' || row.verdict === 'AC') continue
    const href = workspaceLink(row)
    if (href) return { row, href }
  }
  return null
}

export function ResumeCard() {
  const { data } = useQuery({
    queryKey: ['member', 'recent'],
    queryFn: () => api.get<RecentRow[]>('/api/member/submissions/recent?limit=12'),
  })

  const found = data ? pickUnfinished(data) : null
  if (!found) return null
  const { row, href } = found

  return (
    <section className="mb-8 flex items-center gap-5 border border-line-strong bg-surface-2 p-5">
      <div className="min-w-0 flex-1">
        <h2 className="font-mono text-[11px] font-normal tracking-[0.1em] text-moss uppercase">Làm tiếp dở dang</h2>
        <p className="mt-2 truncate text-[18px] font-semibold text-ink-1">{row.problemTitle}</p>
        <p className="num mt-1.5 font-mono text-[12px] text-ink-4">
          lần cuối <span className={row.verdict === 'TLE' || row.verdict === 'MLE' ? 'text-earth' : 'text-clay'}>{row.verdict}</span>
          {row.score !== null ? ` · ${row.score} đ` : null}
        </p>
      </div>
      <Link
        to={href}
        className="flex shrink-0 items-center gap-2.5 bg-[var(--moss-solid,var(--moss))] px-5 py-3 font-mono text-[13px] font-semibold text-on-accent uppercase transition-opacity duration-[120ms] ease-linear hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
      >
        Mở editor <span aria-hidden>→</span>
      </Link>
    </section>
  )
}
