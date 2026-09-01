import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Markdown } from '@/components/markdown/Markdown'
import { EmptyState, Spinner } from '@/components/ui'
import { useCountdown } from '@/hooks/useCountdown'
import { api } from '@/lib/api'
import { LeaderboardPanel } from './workspace/LeaderboardPanel'

interface ContestDetail {
  id: string
  title: string
  descriptionMd: string | null
  startAt: string
  endAt: string
  phase: 'sap-dien-ra' | 'dang-dien-ra' | 'da-ket-thuc'
  problemCount: number
  problems: { id: string; label: string | null; title: string; maxScore: number }[]
}

const PHASE_LABEL = {
  'sap-dien-ra': 'Sắp diễn ra',
  'dang-dien-ra': 'Đang diễn ra',
  'da-ket-thuc': 'Đã kết thúc',
} as const

/** Trang contest (FR-I1/I3/I6): đếm ngược, danh sách bài, bảng xếp hạng. */
export function ContestPage() {
  const { contestId } = useParams()
  const { data, meta, isLoading, refetch } = useContest(contestId)

  const target = data?.phase === 'sap-dien-ra' ? data.startAt : (data?.endAt ?? null)
  // Đếm ngược neo vào ĐỒNG HỒ SERVER, không phải đồng hồ máy người dùng; hết giờ
  // thì tự refetch để đề mở ra mà không cần tải lại trang (FR-I3).
  const remaining = useCountdown(target, (meta?.serverTime as string) ?? null, () => void refetch())

  if (isLoading) return <div className="grid h-full place-items-center"><Spinner /></div>
  if (!data) return <EmptyState title="Không tìm thấy contest" />

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-5 hover:underline">
        <ArrowLeft size={15} /> Trang chủ
      </Link>

      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[26px] text-ink-1">{data.title}</h1>
          <span className="rounded-full bg-surface-sel px-2 py-0.5 text-xs">
            {PHASE_LABEL[data.phase]}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-5">
          {new Date(data.startAt).toLocaleString('vi-VN')} → {new Date(data.endAt).toLocaleString('vi-VN')} ·{' '}
          {data.problemCount} bài
        </p>
        {remaining ? (
          <p className="mt-2 font-mono text-sm" aria-live="polite">
            {data.phase === 'sap-dien-ra' ? 'Bắt đầu sau ' : 'Còn lại '}
            <b>{remaining}</b>
          </p>
        ) : null}
      </header>

      {data.phase === 'da-ket-thuc' ? (
        <p className="mb-4 bg-[var(--tint-earth)] px-3 py-2 text-sm text-earth">
          Chế độ luyện tập — bài nộp vẫn được chấm nhưng không tính vào bảng xếp hạng.
        </p>
      ) : null}

      {data.descriptionMd ? (
        <div className="mb-6 border border-line bg-surface-2 p-4">
          <Markdown source={data.descriptionMd} />
        </div>
      ) : null}

      {data.phase === 'sap-dien-ra' ? (
        <EmptyState title="Đề chưa mở" hint="Danh sách bài sẽ hiện đúng giờ bắt đầu." />
      ) : (
        <ul className="mb-6 grid gap-2">
          {data.problems.map((p) => (
            <li key={p.id}>
              <Link
                to={`/contest/${contestId}/bai/${p.id}`}
                className="flex items-center gap-3 border border-line bg-surface-2 px-4 py-3 transition hover:border-[var(--color-primary)]"
              >
                <span className="font-mono text-sm text-ink-5">{p.label}</span>
                <span className="font-medium">{p.title}</span>
                <span className="ml-auto font-mono text-xs text-ink-6">{p.maxScore} điểm</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="border border-line bg-surface-2">
        <LeaderboardPanel contestId={contestId} />
      </div>
    </div>
  )
}

function useContest(contestId: string | undefined) {
  const query = useQuery({
    queryKey: ['contest', contestId],
    queryFn: () => api.getWithMeta<ContestDetail>(`/api/member/contests/${contestId}`),
    enabled: Boolean(contestId),
    refetchInterval: 30_000,
  })
  return { data: query.data?.data, meta: query.data?.meta, isLoading: query.isLoading, refetch: query.refetch }
}
