/**
 * Trang Bảng xếp hạng toàn CLB (màn riêng, ngoài các panel liếc nhanh ở trang chủ/
 * workspace/team).
 *
 * Hai trục lọc độc lập: PHẠM VI (cá nhân / team) và KỲ (tuần này / tháng này / toàn
 * thời gian, tính theo lịch giờ VN — server làm mốc). Top-3 lên bục vinh danh, phần
 * còn lại xuống bảng; dòng của mình luôn nổi bằng moss.
 *
 * Điểm cộng từ bài luyện của khoá (item), cùng công thức với BXH khoá/team — KHÔNG
 * trộn điểm contest (contest có standings riêng), để con số một nghĩa ở mọi nơi.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { EmptyState, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { LeaderboardTable } from './LeaderboardTable'
import { Podium } from './Podium'
import { toEntries, type IndividualRow, type LbScope, type LbWindow, type TeamRow } from './types'

const SCOPES: { value: LbScope; label: string }[] = [
  { value: 'individual', label: 'Cá nhân' },
  { value: 'team', label: 'Team' },
]
const WINDOWS: { value: LbWindow; label: string }[] = [
  { value: 'week', label: 'Tuần này' },
  { value: 'month', label: 'Tháng này' },
  { value: 'all', label: 'Toàn thời gian' },
]

function TabBar<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'border px-3 py-1.5 font-mono text-[13px] whitespace-nowrap transition-colors duration-120 ease-linear sm:text-[14px]',
            value === o.value
              ? 'border-line-strong bg-surface-1 text-ink-1'
              : 'border-transparent text-ink-5 hover:text-ink-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function BXHPage() {
  const [scope, setScope] = useState<LbScope>('individual')
  const [win, setWin] = useState<LbWindow>('week')

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard-global', scope, win],
    queryFn: () => api.get<IndividualRow[] | TeamRow[]>(`/api/member/leaderboard?scope=${scope}&window=${win}`),
    refetchInterval: 30_000,
  })

  const entries = data ? toEntries(scope, data) : []

  return (
    <main className="mx-auto min-w-0 max-w-3xl px-4 py-8 sm:px-7">
      <p className="num font-mono text-[12px] tracking-[0.14em] text-(--label) uppercase">~/bảng-xếp-hạng</p>
      <h1 className="mt-1.5 mb-1 font-display text-[32px] text-ink-1">Bảng xếp hạng</h1>
      <p className="mb-6 text-[15px] text-ink-4">
        Cộng điểm từ bài luyện của mọi khoá. Đầu tuần (thứ Hai) và đầu tháng làm mới cuộc đua.
      </p>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <TabBar label="Phạm vi" value={scope} onChange={setScope} options={SCOPES} />
        <TabBar label="Kỳ xếp hạng" value={win} onChange={setWin} options={WINDOWS} />
      </div>

      {isLoading ? (
        <div className="py-10">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          title="Chưa có kết quả trong kỳ này"
          hint={scope === 'team' ? 'Chưa team nào ghi điểm.' : 'Chưa ai giải được bài nào trong khoảng thời gian này.'}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <Podium rows={entries} />
          <LeaderboardTable rows={entries.slice(3)} />
        </div>
      )}
    </main>
  )
}
