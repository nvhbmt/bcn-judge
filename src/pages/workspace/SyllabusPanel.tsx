import { useQuery } from '@tanstack/react-query'
import { BookText, Check, CircleDot, Circle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

export interface SyllabusItem {
  id: string
  title: string
  kind: 'lesson' | 'problem'
  position: number
  status: 'chua-lam' | 'da-thu' | 'da-ac' | null
  attempts: number
  points: number | null
}

export interface SyllabusSection {
  id: string
  title: string
  position: number
  /** Mốc mở của chương chưa tới giờ; null nghĩa là không hẹn giờ (đang soạn, hoặc đã mở). */
  unlockAt?: string | null
  items: SyllabusItem[]
}

/** Mục "Giáo trình" của thanh icon (FR-E7): cây chương/mục kèm trạng thái từng bài. */
export function SyllabusPanel({ courseId, currentItemId }: { courseId: string; currentItemId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['syllabus', courseId],
    queryFn: () => api.get<SyllabusSection[]>(`/api/member/courses/${courseId}/syllabus`),
  })

  if (isLoading) return <div className="p-4"><Spinner /></div>
  if (!data || data.length === 0) return <EmptyState title="Khoá học chưa có nội dung" />

  return (
    <nav className="px-2 py-3" aria-label="Giáo trình">
      {data.map((section) => (
        <section key={section.id} className="mb-4">
          <h3 className="px-2 pb-1 text-xs font-semibold tracking-wide text-ink-5 uppercase">{section.title}</h3>
          <ul>
            {section.items.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/khoa-hoc/${courseId}/bai/${item.id}`}
                  aria-current={item.id === currentItemId ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 px-2 py-2 text-[15px]',
                    item.id === currentItemId ? 'bg-primary-soft font-medium' : 'hover:bg-surface-sel',
                  )}
                >
                  <StatusIcon item={item} />
                  <span className="truncate">{item.title}</span>
                  {item.attempts > 0 ? (
                    <span className="ml-auto shrink-0 font-mono text-[13px] text-ink-6">{item.attempts} lần</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  )
}

function StatusIcon({ item }: { item: SyllabusItem }) {
  if (item.kind === 'lesson') return <BookText size={15} className="shrink-0 text-ink-6" aria-label="Bài đọc" />
  if (item.status === 'da-ac') return <Check size={15} className="shrink-0 text-ac" aria-label="Đã AC" />
  if (item.status === 'da-thu')
    return <CircleDot size={15} className="shrink-0 text-tle" aria-label="Đã thử" />
  return <Circle size={15} className="shrink-0 text-ink-6" aria-label="Chưa làm" />
}
