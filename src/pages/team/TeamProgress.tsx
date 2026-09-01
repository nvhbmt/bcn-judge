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
import { Row, RowGroup, Segments } from '@/components/ui/patterns'
import { api } from '@/lib/api'
import type { TeamProgressRow } from './types'

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
      <RowGroup className="mt-3">
        {data.map((row) => {
          const percent = row.totalItems > 0 ? Math.round((row.acCount / row.totalItems) * 100) : 0
          return (
            <Row key={`${row.userId}:${row.courseId}`} className="gap-4">
              <button
                type="button"
                onClick={() => onPick(row.userId)}
                className="min-w-0 flex-1 truncate text-left text-[14px] text-ink-2 hover:text-ink-1 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
              >
                {row.displayName}
              </button>

              <span className="num hidden w-28 shrink-0 truncate font-mono text-[11px] text-ink-5 sm:block">
                {row.courseName}
              </span>

              <span className="hidden w-32 shrink-0 md:block">
                <Segments percent={percent} />
              </span>

              <span className="num w-14 shrink-0 text-right font-mono text-[11px] text-ink-4">
                {row.acCount}/{row.totalItems}
              </span>

              <span
                className={`num w-20 shrink-0 text-right font-mono text-[11px] ${
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
