import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, PencilRuler } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Markdown } from '@/components/markdown/Markdown'
import { Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import type { CourseSummary } from '@/types/api'
import { SyllabusPanel } from './workspace/SyllabusPanel'

/** Trang khoá học: mô tả + giáo trình (FR-B5, FR-C1). */
export function CourseDetailPage() {
  const { courseId } = useParams()
  const { me } = useAuth()
  const { data: course, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => api.get<CourseSummary>(`/api/member/courses/${courseId}`),
    enabled: Boolean(courseId),
  })

  if (isLoading) return <div className="grid h-full place-items-center"><Spinner /></div>
  if (!course) return <p className="p-6 text-sm text-ink-5">Không tìm thấy khoá học.</p>

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-5 hover:underline">
        <ArrowLeft size={15} /> Khoá học của tôi
      </Link>

      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <span className="font-mono text-xs text-ink-5">{course.code}</span>
          <h1 className="font-display text-[26px] text-ink-1">{course.name}</h1>
        </div>
        {me && me.role !== 'member' ? (
          <Link
            to={`/mentor/khoa-hoc/${courseId}`}
            className="inline-flex shrink-0 items-center gap-1.5 border border-line-strong px-3 py-1.5 text-sm font-medium transition hover:bg-surface-sel"
          >
            <PencilRuler size={16} /> Soạn nội dung
          </Link>
        ) : null}
      </header>

      {course.descriptionMd ? (
        <div className="mb-6 border border-line bg-surface-2 p-4">
          <Markdown source={course.descriptionMd} />
        </div>
      ) : null}

      <div className="border border-line bg-surface-2">
        <SyllabusPanel courseId={courseId!} />
      </div>
    </div>
  )
}
