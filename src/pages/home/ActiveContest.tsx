/**
 * Ô contest ở cột phải trang chủ (màn 02).
 *
 * Ưu tiên contest ĐANG diễn ra; không có thì lấy contest sắp tới gần nhất. Đồng hồ
 * đếm ngược là con số to nhất của cột phải (34px) và dùng mono `tabular-nums` — chữ
 * số phải đứng yên chứ không nhảy trái phải mỗi giây.
 *
 * Màu theo nghĩa cố định của hệ: `--earth` là "cần chú ý / đang chạy", nên đồng hồ
 * của contest đang diễn ra màu earth. Contest chưa mở thì chưa cần chú ý — để mực
 * thường, đừng đốt màu nhấn cho một thứ còn ba ngày nữa.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { SidePanel } from '@/components/ui/patterns'
import { useCountdown } from '@/hooks/useCountdown'
import { api } from '@/lib/api'
import { hhmm } from './recent'

type Phase = 'sap-dien-ra' | 'dang-dien-ra' | 'da-ket-thuc'

interface ContestRow {
  id: string
  title: string
  startAt: string
  endAt: string
  phase: Phase
  problemCount: number
  freezeMinutes?: number
}

function pick(rows: ContestRow[]): ContestRow | null {
  return (
    rows.find((r) => r.phase === 'dang-dien-ra') ??
    [...rows].filter((r) => r.phase === 'sap-dien-ra').sort((a, b) => a.startAt.localeCompare(b.startAt))[0] ??
    null
  )
}

export function ActiveContest() {
  // getWithMeta để lấy `serverTime`: đếm ngược phải neo vào đồng hồ MÁY CHỦ, máy
  // người dùng lệch giờ là chuyện thường (FR-I3).
  const { data: res } = useQuery({
    queryKey: ['member', 'contests', 'meta'],
    queryFn: () => api.getWithMeta<ContestRow[]>('/api/member/contests'),
  })
  const data = res?.data
  const contest = data ? pick(data) : null
  const target = contest ? (contest.phase === 'dang-dien-ra' ? contest.endAt : contest.startAt) : null
  const left = useCountdown(target, (res?.meta as { serverTime?: string } | undefined)?.serverTime ?? null)

  if (!data) return null
  if (!contest) {
    return (
      <SidePanel label="Contest">
        <p className="text-[13px] text-ink-5">Chưa có contest nào sắp tới.</p>
      </SidePanel>
    )
  }

  const running = contest.phase === 'dang-dien-ra'
  const freeze = contest.freezeMinutes ?? 0
  const freezeAt = freeze > 0 ? new Date(new Date(contest.endAt).getTime() - freeze * 60_000) : null

  return (
    <SidePanel label={running ? 'Đang diễn ra' : 'Sắp diễn ra'} tone={running ? 'earth' : 'moss'}>
      <Link to={`/contest/${contest.id}`} className="block hover:underline">
        <p className="text-[16px] font-semibold text-ink-1">{contest.title}</p>
      </Link>

      <p className={`num mt-3 font-mono text-[34px] leading-none font-semibold tracking-[-0.02em] ${running ? 'text-earth' : 'text-ink-2'}`}>
        {left ?? '—'}
      </p>

      <p className="num mt-2.5 font-mono text-[11px] text-ink-5">
        {contest.problemCount} bài · {hhmm(contest.startAt)} → {hhmm(contest.endAt)}
        {freezeAt ? ` · đóng băng BXH lúc ${hhmm(freezeAt.toISOString())}` : null}
      </p>
    </SidePanel>
  )
}
