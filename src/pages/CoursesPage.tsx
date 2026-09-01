/**
 * Màn 02 của bản v2 — trang chủ của cả ba vai trò (FR-B5).
 *
 * Bố cục hai cột `1fr | 400px`: cột phải hẹp theo lượng dữ liệu thật chứ không chia
 * 50/50, và tụt một bậc nền (`--surface-3`) có đường kẻ trái. Điều hướng nằm ở
 * TopBar, không phải ở đây.
 *
 * Cột phải chạy hết chiều cao và tự cuộn riêng: contest + log + BXH dài hơn màn hình
 * là chuyện thường, và cuộn cả trang để xem BXH thì mất luôn lời chào ở trên.
 */
import { useQuery } from '@tanstack/react-query'
import { EmptyState, SectionRule, Spinner } from '@/components/ui'
import { Divider, RowGroup, SideColumn } from '@/components/ui/patterns'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import type { CourseSummary } from '@/types/api'
import { ActiveContest } from './home/ActiveContest'
import { ActivityLog } from './home/ActivityLog'
import { CourseRow } from './home/CourseRow'
import { CourseStandings } from './home/CourseStandings'
import { ResumeCard } from './home/ResumeCard'

const WEEKDAY = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${WEEKDAY[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

/** Gọi bằng tên, đúng cách người Việt gọi nhau — không đọc cả họ tên đầy đủ. */
function shortName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/)
  return parts.length > 1 ? parts.slice(-2).join(' ') : displayName
}

export function CoursesPage() {
  const { me } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['member', 'courses'],
    queryFn: () => api.get<CourseSummary[]>('/api/member/courses'),
  })

  const primary = data?.[0]

  return (
    <div className="grid h-full lg:grid-cols-[minmax(0,1fr)_400px]">
      <main className="min-w-0 overflow-y-auto px-7 py-8">
        <p className="num font-mono text-[11px] tracking-[0.14em] text-ink-6 uppercase">{today()}</p>
        <h1 className="mt-1.5 mb-1 font-display text-[28px] text-ink-1">
          Chào {me ? shortName(me.displayName) : 'bạn'}
        </h1>
        <p className="mb-7 text-[14px] text-ink-4">
          {data ? `Bạn đang theo ${data.length} khoá.` : 'Đang tải khoá học của bạn…'}
        </p>

        <ResumeCard />

        <SectionRule label="Khoá học của bạn" meta={data ? `${data.length} khoá` : undefined} />

        {isLoading ? (
          <div className="mt-4">
            <Spinner />
          </div>
        ) : null}
        {data && data.length === 0 ? (
          <EmptyState title="Chưa có khoá học nào" hint="Liên hệ mentor để được ghi danh." />
        ) : null}

        {data && data.length > 0 ? (
          <RowGroup className="mt-4">
            {data.map((course) => (
              <CourseRow key={course.id} course={course} />
            ))}
          </RowGroup>
        ) : null}
      </main>

      <SideColumn className="min-w-0 overflow-y-auto">
        <ActiveContest />
        <Divider />
        <ActivityLog />
        {primary ? (
          <>
            <Divider />
            <CourseStandings courseId={primary.id} courseCode={primary.code} />
          </>
        ) : null}
      </SideColumn>
    </div>
  )
}
