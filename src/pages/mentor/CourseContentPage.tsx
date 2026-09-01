/**
 * FR-C1/C3: mentor soạn giáo trình một khoá — chương, mục, thứ tự, xuất bản.
 * Route: /mentor/khoa-hoc/:courseId
 */
import { useId, useState, type FormEvent } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Button, EmptyState, Spinner } from '@/components/ui'
import { SectionBlock } from './SectionBlock'
import { Field, Notice, TextInput } from './fields'
import { readApiMessage } from './publishGate'
import {
  itemOrder,
  sectionOrder,
  swapped,
  useContentMutations,
  useMentorProblems,
  useSyllabus,
} from './useCourseContent'

export function CourseContentPage() {
  const { courseId = '' } = useParams()
  const titleId = useId()
  const { data, isLoading, isError } = useSyllabus(courseId)
  const { data: problems } = useMentorProblems()
  const { createSection, reorder } = useContentMutations(courseId)
  const [newTitle, setNewTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const sections = data ?? []

  /**
   * Đổi thứ tự = gửi cả dải đã đánh số lại 1..n, chứ không chỉ hai `position` hoán
   * vị: `PUT .../order` ghi đè từng dòng nên dữ liệu cũ trùng/hổng số sẽ tự lành,
   * và thứ tự lưu luôn khớp thứ tự đang hiện.
   */
  function moveSection(index: number, delta: -1 | 1) {
    const next = swapped(sections, index, delta)
    if (!next) return
    setError(null)
    reorder.mutate(sectionOrder(next), {
      onError: (err) => setError(readApiMessage(err, 'Không đổi được thứ tự chương.')),
    })
  }

  function moveItem(sectionIndex: number, index: number, delta: -1 | 1) {
    const section = sections[sectionIndex]
    if (!section) return
    const next = swapped(section.items, index, delta)
    if (!next) return
    setError(null)
    reorder.mutate(itemOrder(section.id, next), {
      onError: (err) => setError(readApiMessage(err, 'Không đổi được thứ tự mục.')),
    })
  }

  function addSection(e: FormEvent) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    setError(null)
    createSection.mutate(title, {
      onSuccess: () => setNewTitle(''),
      onError: (err) => setError(readApiMessage(err, 'Không tạo được chương.')),
    })
  }

  if (isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-5 hover:underline">
        <ArrowLeft size={15} /> Trang chủ
      </Link>

      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] text-ink-1">Soạn nội dung khoá học</h1>
          <p className="text-sm text-ink-5">
            Member chỉ thấy mục đã <b>Xuất bản</b>; mục Nháp là chỗ soạn dở (FR-C3).
          </p>
        </div>
        <Link to={`/khoa-hoc/${courseId}`} className="text-sm text-[var(--color-primary)] hover:underline">
          Xem như member
        </Link>
      </header>

      {isError ? <Notice tone="error">Không đọc được giáo trình — kiểm tra bạn có phụ trách khoá này không.</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {/* aria-live: đổi thứ tự không đổi focus nên người dùng bàn phím/đọc màn hình
          cần một câu báo là thao tác đã chạy. */}
      <p className="sr-only" aria-live="polite">
        {reorder.isPending ? 'Đang lưu thứ tự…' : ''}
      </p>

      {sections.length === 0 && !isError ? (
        <EmptyState title="Khoá chưa có chương nào" hint="Tạo chương đầu tiên ở khung dưới." />
      ) : null}

      {sections.map((section, i) => (
        <SectionBlock
          key={section.id}
          courseId={courseId}
          section={section}
          first={i === 0}
          last={i === sections.length - 1}
          problems={problems ?? []}
          onMoveSection={(delta) => moveSection(i, delta)}
          onMoveItem={(index, delta) => moveItem(i, index, delta)}
        />
      ))}

      <form
        onSubmit={addSection}
        className="border border-dashed border-line-strong p-3"
      >
        <Field id={titleId} label="Chương mới">
          <TextInput
            id={titleId}
            value={newTitle}
            maxLength={200}
            placeholder="Ví dụ: Chương 1 — Mảng và chuỗi"
            onChange={(e) => setNewTitle(e.currentTarget.value)}
          />
        </Field>
        <Button type="submit" variant="primary" disabled={createSection.isPending || !newTitle.trim()}>
          <Plus size={15} /> {createSection.isPending ? 'Đang tạo…' : 'Tạo chương'}
        </Button>
      </form>
    </div>
  )
}
