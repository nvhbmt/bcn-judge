/**
 * Phân bố thời gian chạy — 8 ô theo giới hạn của bài, mỗi ô một dòng ngang.
 *
 * Dòng ngang chứ không phải cột đứng: panel rộng ~320–600 px, nhãn "≤ 125 ms" đứng
 * dưới một cột hẹp thì phải xoay chữ. Ô chứa thời gian của CHÍNH MÌNH tô moss —
 * cùng cách hệ đánh dấu "mình" ở BXH, nên không cần chú giải.
 */
import { cn } from '@/lib/cn'
import type { ProblemStats } from '@/types/api'

type Bucket = ProblemStats['time']['buckets'][number]

/** Ô nào chứa `ms`: ô đầu tiên có `upToMs >= ms`, ô cuối (null) hứng phần vượt. */
export function bucketIndexOf(buckets: Bucket[], ms: number | null): number {
  if (ms === null) return -1
  const i = buckets.findIndex((b) => b.upToMs !== null && ms <= b.upToMs)
  return i === -1 ? buckets.length - 1 : i
}

export function TimeHistogram({ buckets, mineMs }: { buckets: Bucket[]; mineMs: number | null }) {
  const max = Math.max(0, ...buckets.map((b) => b.count))
  const mineIdx = bucketIndexOf(buckets, mineMs)
  if (max === 0) return <p className="text-[13px] text-ink-5">Chưa có bài AC nào để đo.</p>
  return (
    <ol className="flex flex-col gap-1" aria-label="Phân bố thời gian chạy">
      {buckets.map((b, i) => {
        const mine = i === mineIdx
        const label = b.upToMs === null ? `> ${buckets[i - 1]?.upToMs ?? 0} ms` : `≤ ${b.upToMs} ms`
        return (
          <li key={label} className="flex items-center gap-3 text-[12px]">
            <span className={cn('num w-20 shrink-0 text-right font-mono', mine ? 'font-semibold text-moss' : 'text-ink-5')}>
              {label}
            </span>
            <span className="h-2.5 flex-1 bg-surface-2">
              <span
                className={cn('block h-full', mine ? 'bg-moss' : 'bg-ink-4')}
                style={{ width: `${(100 * b.count) / max}%` }}
              />
            </span>
            <span className={cn('num w-8 shrink-0 font-mono', mine ? 'text-moss' : 'text-ink-5')}>{b.count}</span>
          </li>
        )
      })}
    </ol>
  )
}
