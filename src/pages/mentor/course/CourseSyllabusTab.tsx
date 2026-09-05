/**
 * Tab "Giáo trình": cây chương → mục, đổi thứ tự, thêm chương.
 *
 * Ôm luôn mutation của mình thay vì để trang cha truyền xuống — trang cha đã phải lo
 * bốn tab, và ba trong bốn tab kia (`CourseForm`, `CourseEnrollments`, `CourseMentors`)
 * cũng tự lo phần mình. Giữ nguyên một kiểu cho cả bốn.
 *
 * Mọi thao tác ở đây ghi THẲNG lên máy chủ, không gom lại chờ nút Lưu: thêm chương và
 * đổi thứ tự là hai thao tác đơn lẻ của API. Vì vậy tab này không có nút lưu, và không
 * được thêm một cái — nó sẽ ngụ ý thứ đang sửa còn chưa được ghi.
 */
import { Plus } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Button, EmptyState } from '@/components/ui'
import { SectionBlock } from './SectionBlock'
import { Field, Notice, TextInput } from '@/pages/mentor/fields'
import { readApiMessage } from '@/pages/mentor/publishGate'
import {
  itemOrder,
  sectionOrder,
  swapped,
  useContentMutations,
  useMentorProblems,
  useSyllabus,
} from '@/pages/mentor/useCourseContent'

export function CourseSyllabusTab({ courseId }: { courseId: string }) {
  const titleId = useId()
  const { data, isError } = useSyllabus(courseId)
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

  return (
    <div>
      {isError ? <Notice tone="error">Không đọc được giáo trình của khoá này.</Notice> : null}
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

      <form onSubmit={addSection} className="border border-dashed border-line-strong p-3">
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
