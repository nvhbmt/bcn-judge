/**
 * Bảng BXH từ hạng 4 trở xuống (top-3 đã ở bục vinh danh phía trên).
 *
 * Xếp theo SỐ BÀI AC trước rồi tổng điểm (§2.7) — nên hiện cả hai cột: có lúc người
 * ít điểm hơn lại đứng trên vì AC nhiều hơn, giấu một cột là biến quy tắc thành điều
 * bí ẩn. Dòng của mình nền moss + vạch trong bên trái, đúng cách hệ đánh dấu.
 */
import { cn } from '@/lib/cn'
import type { LbEntry } from './types'

export function LeaderboardTable({ rows }: { rows: LbEntry[] }) {
  if (rows.length === 0) return null
  return (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">Bảng xếp hạng từ hạng 4</caption>
      <colgroup>
        <col className="w-12" />
        <col />
        <col className="w-20" />
        <col className="w-20" />
      </colgroup>
      <thead>
        <tr className="border-b border-line text-left font-mono text-[11px] tracking-[0.12em] text-(--label) uppercase">
          <th className="px-3 py-2 font-normal">#</th>
          <th className="py-2 font-normal">Tên</th>
          <th className="px-3 py-2 text-right font-normal">Bài</th>
          <th className="px-3 py-2 text-right font-normal">Điểm</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.key}
            className={cn('border-b border-line', row.isMe && 'bg-primary-soft shadow-[inset_2px_0_0_var(--moss)]')}
          >
            <td className={cn('num px-3 py-2.5 font-mono text-[14px]', row.isMe ? 'text-moss' : 'text-ink-5')}>
              {row.rank}
            </td>
            <td
              title={row.name}
              className={cn('max-w-0 truncate py-2.5 text-[15px]', row.isMe ? 'font-semibold text-ink-1' : 'text-ink-2')}
            >
              {row.isMe ? `${row.name} (bạn)` : row.name}
              {row.meta ? <span className="num ml-1.5 font-mono text-[12px] text-ink-6">{row.meta}</span> : null}
            </td>
            <td className="num px-3 py-2.5 text-right font-mono text-[14px] text-ink-3">{row.acCount}</td>
            <td className={cn('num px-3 py-2.5 text-right font-mono text-[14px]', row.isMe ? 'text-ink-1' : 'text-ink-4')}>
              {row.totalPoints}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
