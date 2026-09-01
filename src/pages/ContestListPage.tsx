/**
 * Danh sách contest của member (FR-I).
 *
 * Trang này THÊM MỚI cùng bản v2. Trước đó `/contest/:id` có route nhưng không màn
 * hình nào link tới, nên member chỉ vào được contest khi ai đó gửi URL — cùng lớp
 * lỗi "cụm không ai tới được" với `/quan-tri` (commit 6bd5cdb). Mục `~/contest` trên
 * thanh trên trỏ vào đây.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { EmptyState, SectionRule, Spinner } from '@/components/ui'
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

const PHASE_LABEL: Record<Phase, string> = {
  'dang-dien-ra': 'Đang diễn ra',
  'sap-dien-ra': 'Sắp diễn ra',
  'da-ket-thuc': 'Đã kết thúc',
}

/** Đang diễn ra dùng moss (đang mở), sắp diễn ra dùng earth (cần chú ý), xong thì mực nhạt. */
const PHASE_COLOR: Record<Phase, string> = {
  'dang-dien-ra': 'var(--moss)',
  'sap-dien-ra': 'var(--earth)',
  'da-ket-thuc': 'var(--ink-6)',
}

const ORDER: Record<Phase, number> = { 'dang-dien-ra': 0, 'sap-dien-ra': 1, 'da-ket-thuc': 2 }

function when(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ContestListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['member', 'contests'],
    queryFn: () => api.get<ContestRow[]>('/api/member/contests'),
  })

  const rows = [...(data ?? [])].sort(
    (a, b) => ORDER[a.phase] - ORDER[b.phase] || b.startAt.localeCompare(a.startAt),
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 font-display text-[26px] text-ink-1">Contest</h1>
      <p className="mb-6 text-[13px] text-ink-5">
        Bài nộp trong khung thời gian mới tính vào bảng xếp hạng.
      </p>

      {isLoading ? <Spinner /> : null}
      {data && rows.length === 0 ? (
        <EmptyState title="Chưa có contest nào" hint="Mentor sẽ mở contest theo tuần." />
      ) : null}

      <ul className="grid gap-px bg-line">
        {rows.map((c) => (
          <li key={c.id}>
            <Link
              to={`/contest/${c.id}`}
              className="flex items-center gap-4 bg-surface-2 px-4 py-3 transition-colors duration-[120ms] ease-linear hover:bg-surface-sel"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: PHASE_COLOR[c.phase] }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[16px] text-ink-1">{c.title}</span>
                <span className="num mt-0.5 block font-mono text-[11px] text-ink-5">
                  {when(c.startAt)} → {when(c.endAt)} · {c.problemCount} bài
                </span>
              </span>
              <span
                className="shrink-0 font-mono text-[11px] tracking-[0.06em]"
                style={{ color: PHASE_COLOR[c.phase] }}
              >
                {PHASE_LABEL[c.phase]}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <SectionRule label="Cách tính điểm" />
        <p className="mt-3 text-[13px] leading-[1.65] text-ink-4">
          Điểm mỗi bài bằng tỉ lệ testcase đúng nhân điểm tối đa của bài. Bảng xếp hạng lấy lần nộp
          tốt nhất trong khung thời gian, không phải lần nộp cuối.
        </p>
      </div>
    </div>
  )
}
