/**
 * Màn 03 của bản v2 — chi tiết khoá học, giáo trình nhóm theo chương (FR-B5, FR-C1).
 *
 * Hai cột `1fr | 380px`: giáo trình bên trái, tiến độ + mentor + ngôn ngữ bên phải.
 * Cột phải hẹp hơn trang chủ (380 so với 400) vì nó chở ít dữ liệu hơn — thiết kế
 * đặt bề rộng theo lượng dữ liệu thật chứ không theo một con số chung.
 */
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, PencilRuler } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Markdown } from '@/components/markdown/Markdown'
import { EmptyState, Spinner } from '@/components/ui'
import { SideColumn } from '@/components/ui/patterns'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import type { CourseDetail } from '@/types/api'
import { CourseSide } from './course/CourseSide'
import { SyllabusList } from './course/SyllabusList'
import type { SyllabusSection } from './workspace/SyllabusPanel'

export function CourseDetailPage() {
  const { courseId } = useParams()
  const { me } = useAuth()

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => api.get<CourseDetail>(`/api/member/courses/${courseId}`),
    enabled: Boolean(courseId),
  })
  const { data: sections } = useQuery({
    queryKey: ['syllabus', courseId],
    queryFn: () => api.get<SyllabusSection[]>(`/api/member/courses/${courseId}/syllabus`),
    enabled: Boolean(courseId),
  })

  if (isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }
  if (!course) return <p className="p-6 text-[13px] text-ink-5">Không tìm thấy khoá học.</p>

  return (
    <div className="grid h-full lg:grid-cols-[minmax(0,1fr)_380px]">
      <main className="min-w-0 overflow-y-auto px-7 py-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              to="/"
              className="mb-3 inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-5 hover:text-ink-2"
            >
              <ArrowLeft size={13} /> ~/khoá-học
            </Link>
            <p className="num font-mono text-[14px] text-moss">{course.code}</p>
            <h1 className="mt-2 font-display text-[32px] text-ink-1">{course.name}</h1>
          </div>

          {me && me.role !== 'member' ? (
            <Link
              to={`/mentor/khoa-hoc/${courseId}/thong-tin`}
              className="inline-flex shrink-0 items-center gap-1.5 border border-line-strong px-3 py-1.5 font-mono text-[12px] text-ink-3 transition-colors duration-120 ease-linear hover:bg-surface-sel"
            >
              <PencilRuler size={14} /> Soạn nội dung
            </Link>
          ) : null}
        </div>

        {course.descriptionMd ? (
          <div className="mb-7 max-w-165 text-[17px] leading-[1.7] text-ink-4">
            <Markdown source={course.descriptionMd} />
          </div>
        ) : null}

        {sections && sections.length === 0 ? <EmptyState title="Khoá học chưa có nội dung" /> : null}
        {sections && sections.length > 0 ? <SyllabusList courseId={courseId!} sections={sections} /> : null}
      </main>

      <SideColumn className="min-w-0 overflow-y-auto">
        <CourseSide course={course} sections={sections ?? []} />
      </SideColumn>
    </div>
  )
}
