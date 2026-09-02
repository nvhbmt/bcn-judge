/**
 * FR-B2/C1/C3 — MỘT màn sửa khoá cho cả admin lẫn mentor.
 * Route: /mentor/khoa-hoc/:courseId/:tab?
 *
 * Trước đây hai vai có hai màn khác nhau: admin sửa mã/tên/mentor/ghi danh ở
 * `/quan-tri/khoa-hoc/:id`, mentor soạn giáo trình ở đây. Cùng một khoá mà hai chỗ,
 * và không chỗ nào làm được hết việc — admin muốn thêm chương phải nhảy sang màn kia.
 *
 * Giờ một màn: **tab dọc bên trái** cho phần cấu hình khoá, **giáo trình là panel
 * phải cố định** — nó là việc chính của màn này nên luôn nhìn thấy, không phải bấm
 * tab mới ra.
 *
 * Luật của tab: **thấy tab nghĩa là sửa được trong đó**. Phần nào vai này chỉ đọc thì
 * ẩn hẳn thay vì hiện ra rồi khoá. Bảng ai-thấy-gì nằm ở `courseTabs.ts` và phải khớp
 * ma trận quyền ở server.
 */
import { ArrowLeft } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { SplitPane } from '@/components/layout/SplitPane'
import { EmptyState, SectionRule, Spinner } from '@/components/ui'
import { CourseEnrollments } from '@/pages/admin/CourseEnrollments'
import { CourseForm } from '@/pages/admin/CourseForm'
import { CourseMentors } from '@/pages/admin/CourseMentors'
import { useAdminCourse } from '@/pages/admin/useAdminLists'
import { useAuth } from '@/stores/auth'
import { CourseInfoPanel } from './CourseInfoPanel'
import { CourseSyllabusTab } from './CourseSyllabusTab'
import { CourseTabRail } from './CourseTabRail'
import { resolveTab, tabsFor } from './courseTabs'
import { useCourseDescription, useCourseMentors, useMentorCourse } from './useCourseContent'
import { readApiMessage } from './publishGate'
import { useState } from 'react'

export function CourseContentPage() {
  const { courseId = '', tab: rawTab } = useParams()
  const navigate = useNavigate()
  const role = useAuth((s) => s.me?.role)
  const tabs = tabsFor(role)
  const tab = resolveTab(rawTab, tabs)

  const { data: course, isLoading, isError } = useMentorCourse(courseId)
  const { data: mentors } = useCourseMentors(courseId)
  const saveDescription = useCourseDescription(courseId)
  const [descError, setDescError] = useState<string | null>(null)
  const [descSaved, setDescSaved] = useState(false)

  // Form đầy đủ của admin cần dòng `courses` bản admin (có `mentorCount`…), thứ chỉ
  // danh sách admin mới trả. Mentor không gọi được endpoint đó nên `found` là undefined
  // — và đúng như vậy: mentor không có form đầy đủ để dựng.
  const { found: adminCourse } = useAdminCourse(courseId, role === 'admin')

  if (rawTab === undefined) return <Navigate to={`/mentor/khoa-hoc/${courseId}/${tab}`} replace />

  if (isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }
  if (isError || !course) {
    return (
      <div className="mx-auto w-full max-w-5xl px-7 py-8">
        <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-5 hover:underline">
          <ArrowLeft size={15} /> Trang chủ
        </Link>
        <EmptyState title="Không mở được khoá học" hint="Kiểm tra bạn có phụ trách khoá này không." />
      </div>
    )
  }

  const active = tabs.find((t) => t.id === tab)!

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-2">
        <Link
          to={role === 'admin' ? '/quan-tri/khoa-hoc' : '/'}
          className="inline-flex items-center gap-1 text-sm text-ink-5 hover:underline"
        >
          <ArrowLeft size={15} /> {role === 'admin' ? 'Danh sách khoá học' : 'Trang chủ'}
        </Link>
        <h1 className="truncate font-display text-[16px] text-ink-1">{course.name}</h1>
        <span className="font-mono text-xs text-ink-6">{course.code}</span>
        <Link to={`/khoa-hoc/${courseId}`} className="ml-auto text-sm text-[var(--color-primary)] hover:underline">
          Xem như member
        </Link>
      </header>

      <div className="min-h-0 flex-1">
        <SplitPane
          storageKey="bcn:mentor-course"
          defaultRatio={0.46}
          minPx={380}
          left={
            <div className="flex h-full min-h-0 flex-col sm:flex-row">
              <CourseTabRail courseId={courseId} tabs={tabs} />
              <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
                <SectionRule label={active.label} />
                <p className="mt-1 mb-4 text-xs text-ink-5">{active.hint}</p>

                {tab === 'thong-tin' ? (
                  role === 'admin' && adminCourse ? (
                    // `onDone` chạy cả khi lưu xong lẫn khi bấm Huỷ. Để no-op thì "Huỷ"
                    // thành nút chết, nên cả hai đưa về danh sách — đúng như màn sửa cũ.
                    <CourseForm course={adminCourse} onDone={() => navigate('/quan-tri/khoa-hoc')} />
                  ) : (
                    <CourseInfoPanel
                      key={course.id}
                      course={course}
                      mentors={mentors ?? []}
                      pending={saveDescription.isPending}
                      saved={descSaved}
                      error={descError}
                      onSave={(descriptionMd) => {
                        setDescError(null)
                        setDescSaved(false)
                        saveDescription.mutate(descriptionMd, {
                          onSuccess: () => setDescSaved(true),
                          onError: (err) => setDescError(readApiMessage(err, 'Không lưu được mô tả khoá.')),
                        })
                      }}
                    />
                  )
                ) : null}

                {tab === 'ghi-danh' ? (
                  <CourseEnrollments courseId={courseId} scope={role === 'admin' ? 'admin' : 'mentor'} />
                ) : null}
                {tab === 'mentor' ? <CourseMentors courseId={courseId} /> : null}
              </div>
            </div>
          }
          right={
            <div className="h-full min-h-0 overflow-auto px-5 py-4">
              <SectionRule label="Giáo trình" />
              <p className="mt-1 mb-4 text-xs text-ink-5">
                Chương, mục và thứ tự. Member chỉ thấy mục đã <b>Xuất bản</b>.
              </p>
              <CourseSyllabusTab courseId={courseId} />
            </div>
          }
        />
      </div>
    </div>
  )
}
