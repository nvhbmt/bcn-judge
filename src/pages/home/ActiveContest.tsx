/**
 * Ô contest ở cột phải trang chủ (màn 02).
 *
 * Ưu tiên contest ĐANG diễn ra; không có thì lấy contest sắp tới gần nhất. Đồng hồ
 * đếm ngược dùng mono `tabular-nums` — chữ số phải đứng yên chứ không nhảy trái
 * phải mỗi giây.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { SectionRule } from '@/components/ui'
import { useCountdown } from '@/hooks/useCountdown'
import { api } from '@/lib/api'

type Phase = 'sap-dien-ra' | 'dang-dien-ra' | 'da-ket-thuc'

interface ContestRow {
  id: string
  title: string
  startAt: string
  endAt: string
  phase: Phase
  problemCount: number
}

function pick(rows: ContestRow[]): ContestRow | null {
  return (
    rows.find((r) => r.phase === 'dang-dien-ra') ??
    [...rows].filter((r) => r.phase === 'sap-dien-ra').sort((a, b) => a.startAt.localeCompare(b.startAt))[0] ??
    null
  )
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
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
  // Đang diễn ra thì đếm tới lúc đóng; sắp diễn ra thì đếm tới lúc mở.
  const target = contest ? (contest.phase === 'dang-dien-ra' ? contest.endAt : contest.startAt) : null
  const left = useCountdown(target, (res?.meta as { serverTime?: string } | undefined)?.serverTime ?? null)

  if (!data) return null
  if (!contest) {
    return (
      <section>
        <SectionRule label="Contest" />
        <p className="mt-3 text-[13px] text-ink-5">Chưa có contest nào sắp tới.</p>
      </section>
    )
  }

  const running = contest.phase === 'dang-dien-ra'
  return (
    <section>
      <SectionRule label={running ? 'Đang diễn ra' : 'Sắp diễn ra'} />
      <Link to={`/contest/${contest.id}`} className="mt-3 block">
        <p className="font-display text-[18px] text-ink-1">{contest.title}</p>
        <p className="num mt-2 font-mono text-[24px] text-moss">{left ?? '—'}</p>
        <p className="num mt-1.5 font-mono text-[11px] text-ink-5">
          {contest.problemCount} bài · {hhmm(contest.startAt)} → {hhmm(contest.endAt)}
        </p>
        <p className="mt-1 font-mono text-[11px] text-ink-6">
          {running ? 'còn lại tới lúc đóng' : 'còn lại tới lúc mở'}
        </p>
      </Link>
    </section>
  )
}
