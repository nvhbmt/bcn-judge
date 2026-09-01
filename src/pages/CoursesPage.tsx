/**
 * Màn 02 của bản v2 — trang chủ của cả ba vai trò (FR-B5).
 *
 * Bố cục hai cột `1fr | 400px`: cột phải hẹp theo lượng dữ liệu thật chứ không
 * chia 50/50. Điều hướng nằm ở TopBar, không phải ở đây.
 */
import { useQuery } from '@tanstack/react-query'
import { EmptyState, SectionRule, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import type { CourseSummary } from '@/types/api'
import { ActiveContest } from './home/ActiveContest'
import { ActivityLog } from './home/ActivityLog'
import { CourseCard } from './home/CourseCard'

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

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8">
        <p className="num font-mono text-[11px] tracking-[0.14em] text-ink-6 uppercase">{today()}</p>
        <h1 className="mt-1.5 font-display text-[31px] text-ink-1">
          Chào {me ? shortName(me.displayName) : 'bạn'}
        </h1>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
        <main>
          <SectionRule label="Khoá học của bạn" meta={data ? `${data.length} khoá` : undefined} />

          {isLoading ? (
            <div className="mt-4">
              <Spinner />
            </div>
          ) : null}
          {data && data.length === 0 ? (
            <EmptyState title="Chưa có khoá học nào" hint="Liên hệ mentor để được ghi danh." />
          ) : null}

          <ul className="mt-4 grid gap-2">
            {data?.map((course) => (
              <li key={course.id}>
                <CourseCard course={course} />
              </li>
            ))}
          </ul>
        </main>

        <aside className="grid content-start gap-8">
          <ActiveContest />
          <ActivityLog />
        </aside>
      </div>
    </div>
  )
}
