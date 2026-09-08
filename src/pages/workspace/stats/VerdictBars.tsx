/**
 * Thanh ngang xếp chồng theo verdict + chú giải.
 *
 * Màu lấy ĐÚNG token `--verdict-*` mà huy hiệu verdict dùng (design-system/tokens/
 * colors.css), không phải bảng màu riêng cho biểu đồ: người đọc vừa thấy WA màu clay
 * ở bảng kết quả, sang đây phải thấy cùng màu đó — đổi token là cả hai đổi theo.
 * Không thư viện chart: sáu đoạn div đủ, và một thư viện chỉ để vẽ một thanh là
 * gánh nặng bundle cho mọi màn khác.
 */
import { VerdictBadge } from '@/components/ui'
import type { ProblemStats, Verdict } from '@/types/api'

const ORDER: (keyof ProblemStats['verdicts'])[] = ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE']

export function VerdictBars({ verdicts, total }: { verdicts: ProblemStats['verdicts']; total: number }) {
  const parts = ORDER.map((v) => ({ v, n: verdicts[v] ?? 0 })).filter((p) => p.n > 0)
  if (total === 0 || parts.length === 0) return null
  const summary = parts.map((p) => `${p.v} ${p.n}`).join(', ')
  return (
    <div>
      <div role="img" aria-label={`Phân bố verdict: ${summary}`} className="flex h-3 w-full overflow-hidden bg-surface-2">
        {parts.map((p) => (
          <span
            key={p.v}
            title={`${p.v}: ${p.n}`}
            className="block h-full"
            style={{ width: `${(100 * p.n) / total}%`, background: `var(--verdict-${p.v.toLowerCase()})` }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
        {parts.map((p) => (
          <li key={p.v} className="flex items-center gap-1.5 text-[12px]">
            <VerdictBadge verdict={p.v as Verdict} tone="soft" />
            <span className="num font-mono text-ink-3">{p.n}</span>
            <span className="num font-mono text-ink-6">{Math.round((100 * p.n) / total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
