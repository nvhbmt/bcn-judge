import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Markdown } from '@/components/markdown/Markdown'
import { Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import type { CourseSummary } from '@/types/api'
import { SyllabusPanel } from './workspace/SyllabusPanel'

/** Trang khoá học: mô tả + giáo trình (FR-B5, FR-C1). */
export function CourseDetailPage() {
  const { courseId } = useParams()
  const { data: course, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => api.get<CourseSummary>(`/api/member/courses/${courseId}`),
    enabled: Boolean(courseId),
  })

  if (isLoading) return <div className="grid h-full place-items-center"><Spinner /></div>
  if (!course) return <p className="p-6 text-sm text-slate-500">Không tìm thấy khoá học.</p>

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:underline">
        <ArrowLeft size={15} /> Khoá học của tôi
      </Link>

      <header className="mb-5">
        <span className="font-mono text-xs text-slate-500">{course.code}</span>
        <h1 className="text-xl font-semibold">{course.name}</h1>
      </header>

      {course.descriptionMd ? (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <Markdown source={course.descriptionMd} />
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <SyllabusPanel courseId={courseId!} />
      </div>
    </div>
  )
}
