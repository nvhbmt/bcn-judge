/**
 * Bảng "Tiến độ theo khoá" của leader (màn 06, FR-J2).
 *
 * Một dòng cho mỗi cặp (thành viên, khoá). Thanh 18 ô cho leader đọc được tiến độ
 * bằng mắt mà không phải so hai con số — đó là việc họ làm khi lướt cả nhóm.
 *
 * Cột "nộp gần nhất" là thứ leader thật sự đi tìm: ai đang im lặng cả tuần. Nên
 * "chưa nộp" tô màu earth chứ không để lẫn vào mực nhạt như một ô trống.
 */
import { useQuery } from '@tanstack/react-query'
import { EmptyState, SectionRule, Spinner } from '@/components/ui'
import { Row, RowGroup, RowHead, Segments } from '@/components/ui/patterns'
import { api } from '@/lib/api'
import type { TeamProgressRow } from './types'

/** Lưới cột dùng chung giữa hàng tiêu đề và các dòng, để mọi cột thẳng hàng. */
const COLS = '1fr 160px 150px 72px 96px'

export function TeamProgress({ teamId, onPick }: { teamId: string; onPick: (userId: string) => void }) {
  const { data } = useQuery({
    queryKey: ['team', teamId, 'progress'],
    queryFn: () => api.get<TeamProgressRow[]>(`/api/member/teams/${teamId}/progress`),
  })

  if (!data) return <Spinner />
  if (data.length === 0) return <EmptyState title="Chưa thành viên nào ghi danh khoá đang mở" />

  return (
    <section className="mb-8">
      <SectionRule label="Tiến độ theo khoá" meta={`${data.length} dòng`} />
      <div className="mt-3">
        <RowHead cols={COLS}>
          <span>thành viên</span>
          <span>khoá</span>
          <span>tiến độ</span>
          <span className="text-right">đã AC</span>
          <span className="text-right">nộp gần nhất</span>
        </RowHead>
      </div>
      <RowGroup className="mt-px border-t-0">
        {data.map((row) => {
          const percent = row.totalItems > 0 ? Math.round((row.acCount / row.totalItems) * 100) : 0
          return (
            <Row key={`${row.userId}:${row.courseId}`} cols={COLS}>
              <button
                type="button"
                onClick={() => onPick(row.userId)}
                className="min-w-0 truncate text-left text-[14px] text-ink-2 hover:text-ink-1 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
              >
                {row.displayName}
              </button>

              <span className="num min-w-0 truncate font-mono text-[11px] text-ink-5">{row.courseName}</span>

              <span>
                <Segments percent={percent} />
              </span>

              <span className="num text-right font-mono text-[11px] text-ink-4">
                {row.acCount}/{row.totalItems}
              </span>

              <span
                className={`num text-right font-mono text-[11px] ${
                  row.lastSubmittedAt ? 'text-ink-6' : 'text-earth'
                }`}
              >
                {row.lastSubmittedAt
                  ? new Date(row.lastSubmittedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
                  : 'chưa nộp'}
              </span>
            </Row>
          )
        })}
      </RowGroup>
    </section>
  )
}
