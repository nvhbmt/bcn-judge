/**
 * Màn 05 của bản v2 — trang contest (FR-I1/I3/I6).
 *
 * Hai cột `1fr | 420px`: đề và điểm của mình bên trái, bảng xếp hạng bên phải.
 * Cột phải từng là 520px khi bảng xếp hạng có MỘT CỘT CHO MỖI BÀI; bảng đó nay chỉ
 * còn bốn cột (xem ContestStandings) nên 520 thành chỗ trống, và 420 cho khớp màn
 * /team — thiết kế đặt bề rộng theo lượng dữ liệu thật.
 *
 * Đếm ngược là con số to nhất màn hình và neo vào ĐỒNG HỒ MÁY CHỦ, không phải đồng hồ
 * máy người dùng (FR-I3).
 */
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Markdown } from '@/components/markdown/Markdown'
import { EmptyState, SectionRule, Spinner } from '@/components/ui'
import { SideColumn, SidePanel } from '@/components/ui/patterns'
import { useCountdown } from '@/hooks/useCountdown'
import { ContestProblems } from './contest/ContestProblems'
import { ContestStandings } from './contest/ContestStandings'
import { useContestDetail } from './contest/useContestDetail'
import { MyScore } from './contest/MyScore'
import { hhmm } from './home/recent'
import { cn } from '@/lib/cn'

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
  const { contest: data, meta, isLoading, refetch } = useContestDetail(contestId, { refetchInterval: 30_000 })

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
    <div className="grid h-full lg:grid-cols-[minmax(0,1fr)_420px]">
      <main className="min-w-0 overflow-y-auto px-7 py-8">
        <Link to="/contest" className="mb-3 inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-5 hover:text-ink-2">
          <ArrowLeft size={13} /> ~/contest
        </Link>

        <p className="mb-2 flex items-center gap-2 font-mono text-[12px] tracking-[0.14em] text-ink-4 uppercase">
          <span aria-hidden className={cn('size-1.75 rounded-full', PHASE_DOT[data.phase])} />
          {PHASE_LABEL[data.phase]}
        </p>
        <h1 className="font-display text-[30px] text-ink-1">{data.title}</h1>
        <p className="num mt-2 font-mono text-[14px] text-ink-5">
          {ngay(data.startAt)} · {hhmm(data.startAt)} → {hhmm(data.endAt)} · {data.problemCount} bài ·{' '}
          {diemToiDa} điểm tối đa
        </p>

        {remaining ? (
          <div className="mt-6" aria-live="polite">
            {/* Nhãn và số CÙNG HÀNG, canh theo baseline: nhãn xếp trên số 52px thì hai
                dòng cách nhau xa quá, đọc ra thành hai mẩu rời chứ không phải một số
                có tên. `flex-wrap` để màn hẹp vẫn xuống dòng thay vì tràn.
                Nhãn mang màu earth chứ không phải màu nhãn chung: nó nói cùng một
                chuyện với con số bên cạnh, tách màu là tách nghĩa. */}
            <div className="flex flex-wrap items-baseline gap-4">
              <p
                className={cn(
                  'shrink-0 font-mono text-[12px] font-semibold tracking-[0.14em] uppercase',
                  running ? 'text-earth' : 'text-(--label)',
                )}
              >
                {data.phase === 'sap-dien-ra' ? 'Bắt đầu sau' : 'Còn lại'}
              </p>
              <p className={cn(
                'num font-mono text-[52px] leading-none font-semibold tracking-[-0.03em]',
                running ? 'text-earth' : 'text-ink-2',
              )}>
                {remaining}
              </p>
            </div>
            {running && freezeAt ? (
              <p className="num mt-2 font-mono text-[12px] text-ink-5">BXH đóng băng lúc {hhmm(freezeAt.toISOString())}</p>
            ) : null}
          </div>
        ) : null}

        {data.phase === 'da-ket-thuc' ? (
          <p className="mt-6 border-l-2 border-earth bg-(--tint-earth) px-3 py-2 text-[13px] text-ink-3">
            Chế độ luyện tập — bài nộp vẫn được chấm nhưng không tính vào bảng xếp hạng.
          </p>
        ) : null}

        {/* Không còn trần 660px: thể lệ contest không phải văn xuôi đọc một mạch mà là
            danh sách quy định + ví dụ mã, người ta QUÉT chứ không đọc từng dòng, và
            660px làm gần nửa cột bỏ trống. Đánh đổi có thật: trên màn rất rộng, dòng
            dài hơn khoảng 45–90 ký tự mà sách vở khuyên cho văn xuôi. */}
        {data.descriptionMd ? (
          <div className="mt-6 text-[16px] leading-[1.7] text-ink-4">
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
        {/* Cùng khung với cột bên trang chủ — hai cột bên trông như nhau thì người
            dùng không phải học lại bố cục ở mỗi màn. */}
        <SidePanel label="Bảng xếp hạng" flush>
          <ContestStandings contestId={contestId!} problems={data.problems} />
        </SidePanel>
      </SideColumn>
    </div>
  )
}

