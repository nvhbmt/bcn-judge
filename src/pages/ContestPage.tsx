/**
 * Màn 05 của bản v2 — trang contest (FR-I1/I3/I6).
 *
 * Hai cột `1fr | 520px`: đề và điểm của mình bên trái, bảng xếp hạng bên phải. Cột
 * phải rộng nhất trong cả app (520 so với 400 của trang chủ và 380 của khoá học) vì
 * nó chở một bảng nhiều cột — thiết kế đặt bề rộng theo lượng dữ liệu thật.
 *
 * Đếm ngược là con số to nhất màn hình và neo vào ĐỒNG HỒ MÁY CHỦ, không phải đồng hồ
 * máy người dùng (FR-I3).
 */
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Markdown } from '@/components/markdown/Markdown'
import { EmptyState, SectionRule, Spinner } from '@/components/ui'
import { SideColumn } from '@/components/ui/patterns'
import { useCountdown } from '@/hooks/useCountdown'
import { api } from '@/lib/api'
import { ContestProblems } from './contest/ContestProblems'
import { ContestStandings } from './contest/ContestStandings'
import { MyScore } from './contest/MyScore'
import { hhmm } from './home/recent'

interface ContestDetail {
  id: string
  title: string
  descriptionMd: string | null
  startAt: string
  endAt: string
  phase: 'sap-dien-ra' | 'dang-dien-ra' | 'da-ket-thuc'
  freezeMinutes: number
  problemCount: number
  problems: { id: string; label: string | null; title: string; maxScore: number }[]
}

const PHASE_LABEL = {
  'sap-dien-ra': 'Sắp diễn ra',
  'dang-dien-ra': 'Đang diễn ra',
  'da-ket-thuc': 'Đã kết thúc',
} as const

const PHASE_DOT = {
  'sap-dien-ra': 'bg-line-strong',
  'dang-dien-ra': 'bg-earth',
  'da-ket-thuc': 'bg-line-strong',
} as const

function ngay(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN')
}

export function ContestPage() {
  const { contestId } = useParams()
  const { data, meta, isLoading, refetch } = useContest(contestId)

  const target = data?.phase === 'sap-dien-ra' ? data.startAt : (data?.endAt ?? null)
  // Hết giờ thì tự refetch để đề mở ra mà không cần tải lại trang (FR-I3).
  const remaining = useCountdown(target, (meta?.serverTime as string) ?? null, () => void refetch())

  if (isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }
  if (!data) return <EmptyState title="Không tìm thấy contest" />

  const running = data.phase === 'dang-dien-ra'
  const diemToiDa = data.problems.reduce((sum, p) => sum + p.maxScore, 0)
  const freezeAt =
    data.freezeMinutes > 0 ? new Date(new Date(data.endAt).getTime() - data.freezeMinutes * 60_000) : null

  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_520px]">
      <main className="min-w-0 overflow-y-auto px-7 py-8">
        <Link to="/contest" className="mb-3 inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-5 hover:text-ink-2">
          <ArrowLeft size={13} /> ~/contest
        </Link>

        <p className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-ink-4 uppercase">
          <span aria-hidden className={`size-[7px] rounded-full ${PHASE_DOT[data.phase]}`} />
          {PHASE_LABEL[data.phase]}
        </p>
        <h1 className="font-display text-[26px] text-ink-1">{data.title}</h1>
        <p className="num mt-2 font-mono text-[12px] text-ink-5">
          {ngay(data.startAt)} · {hhmm(data.startAt)} → {hhmm(data.endAt)} · {data.problemCount} bài ·{' '}
          {diemToiDa} điểm tối đa
        </p>

        {remaining ? (
          <div className="mt-6" aria-live="polite">
            <p className="font-mono text-[11px] tracking-[0.14em] text-ink-6 uppercase">
              {data.phase === 'sap-dien-ra' ? 'Bắt đầu sau' : 'Còn lại'}
            </p>
            <p className={`num mt-1.5 font-mono text-[34px] leading-none font-semibold tracking-[-0.02em] ${running ? 'text-earth' : 'text-ink-2'}`}>
              {remaining}
            </p>
            {running && freezeAt ? (
              <p className="num mt-2 font-mono text-[11px] text-ink-5">BXH đóng băng lúc {hhmm(freezeAt.toISOString())}</p>
            ) : null}
          </div>
        ) : null}

        {data.phase === 'da-ket-thuc' ? (
          <p className="mt-6 border-l-2 border-earth bg-[var(--tint-earth)] px-3 py-2 text-[13px] text-ink-3">
            Chế độ luyện tập — bài nộp vẫn được chấm nhưng không tính vào bảng xếp hạng.
          </p>
        ) : null}

        {data.descriptionMd ? (
          <div className="mt-6 max-w-[660px] text-[14px] leading-[1.7] text-ink-4">
            <Markdown source={data.descriptionMd} />
          </div>
        ) : null}

        <div className="mt-8">
          <SectionRule label="Đề bài" meta={`${data.problemCount} bài`} />
          <div className="mt-3">
            {data.phase === 'sap-dien-ra' ? (
              <EmptyState title="Đề chưa mở" hint="Danh sách bài sẽ hiện đúng giờ bắt đầu." />
            ) : (
              <ContestProblems contestId={contestId!} problems={data.problems} />
            )}
          </div>
        </div>

        {data.phase !== 'sap-dien-ra' ? (
          <div className="mt-8">
            <SectionRule label="Điểm của bạn" />
            <div className="mt-3">
              <MyScore contestId={contestId!} />
            </div>
          </div>
        ) : null}
      </main>

      <SideColumn className="min-w-0 overflow-y-auto">
        <section>
          <SectionRule label="Bảng xếp hạng" meta="cập nhật mỗi 5s" />
          <div className="mt-3">
            <ContestStandings contestId={contestId!} problems={data.problems} />
          </div>
        </section>
      </SideColumn>
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
