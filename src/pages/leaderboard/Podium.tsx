/**
 * Bục vinh danh top-3 của trang BXH.
 *
 * Bố cục kinh điển 2–1–3: hạng nhất ở GIỮA và cao nhất. "Cao hơn" làm bằng
 * `items-end` + đệm trên khác nhau, không bằng chiều cao cứng — cột nào tên dài xuống
 * dòng vẫn đáy thẳng hàng.
 *
 * Mỗi bục có một KHỐI MÀU trên đỉnh (motif của hệ thiết kế): hạng nhất brass (màu
 * "leader"), nhì xám trung tính, ba nâu đất — đủ để mắt tách ba bậc mà không phải ba
 * màu nhấn loè loẹt. Cúp 🏆 cho hạng nhất, huy chương cho nhì/ba. Dòng của CHÍNH MÌNH
 * viền moss, đúng cách hệ đánh dấu "đang chọn".
 */
import { cn } from '@/lib/cn'
import type { LbEntry } from './types'

const CAP: Record<number, string> = { 1: 'bg-brass', 2: 'bg-ink-4', 3: 'bg-earth' }
const AWARD: Record<number, string> = { 1: '🏆', 2: '🥈', 3: '🥉' }

function Block({ row }: { row: LbEntry }) {
  const first = row.rank === 1
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col self-end border bg-surface-2',
        first ? 'order-2' : row.rank === 2 ? 'order-1' : 'order-3',
        row.isMe ? 'border-moss shadow-[inset_0_0_0_1px_var(--moss)]' : 'border-line-strong',
      )}
    >
      <div className={cn('h-1.5 w-full shrink-0', CAP[row.rank])} />
      <div className={cn('flex flex-col items-center px-2 text-center', first ? 'pt-5 pb-6 sm:pt-7' : 'pt-3 pb-4')}>
        <div className={cn('leading-none', first ? 'text-3xl sm:text-4xl' : 'text-2xl')} aria-hidden>
          {AWARD[row.rank]}
        </div>
        <div className={cn('mt-1 font-display text-ink-2', first ? 'text-3xl sm:text-4xl' : 'text-2xl')}>
          {row.rank}
        </div>
        <div
          title={row.name}
          className={cn(
            'mt-1.5 max-w-full truncate text-[14px] sm:text-[15px]',
            row.isMe ? 'font-semibold text-ink-1' : 'font-medium text-ink-2',
          )}
        >
          {row.isMe ? `${row.name} (bạn)` : row.name}
        </div>
        {row.meta ? <div className="num font-mono text-[11px] text-ink-6">{row.meta}</div> : null}
        <div className="num mt-1 font-mono text-[12px] text-ink-5">
          {row.acCount} bài · <span className="text-ink-3">{row.totalPoints}đ</span>
        </div>
      </div>
    </div>
  )
}

export function Podium({ rows }: { rows: LbEntry[] }) {
  const top = rows.slice(0, 3)
  if (top.length === 0) return null
  return (
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
      {top.map((r) => (
        <Block key={r.key} row={r} />
      ))}
    </div>
  )
}
