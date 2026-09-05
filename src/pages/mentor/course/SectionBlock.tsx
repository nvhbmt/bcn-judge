/** Một chương: đổi thứ tự chương, danh sách mục, form thêm mục (FR-C1). */
import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'
import { ItemRow } from './ItemRow'
import { NewItemForm } from './NewItemForm'
import { Notice } from './fields'
import type { SyllabusSection } from './mentorTypes'
import { readApiMessage } from './publishGate'
import type { MentorProblemRow } from './types'
import { useCreateItem } from './useCourseContent'

export function SectionBlock({
  courseId,
  section,
  first,
  last,
  problems,
  onMoveSection,
  onMoveItem,
}: {
  courseId: string
  section: SyllabusSection
  first: boolean
  last: boolean
  problems: MentorProblemRow[]
  onMoveSection: (delta: -1 | 1) => void
  onMoveItem: (index: number, delta: -1 | 1) => void
}) {
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createItem = useCreateItem(courseId)

  return (
    <section className="mb-4 border border-line bg-surface-2">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate font-display text-[15px] text-ink-1">{section.title}</h2>
        <span className="text-xs text-ink-5">{section.items.length} mục</span>
        <Button
          onClick={() => onMoveSection(-1)}
          disabled={first}
          aria-label={`Đưa chương ${section.title} lên trên`}
          className="px-1.5"
        >
          <ArrowUp size={14} />
        </Button>
        <Button
          onClick={() => onMoveSection(1)}
          disabled={last}
          aria-label={`Đưa chương ${section.title} xuống dưới`}
          className="px-1.5"
        >
          <ArrowDown size={14} />
        </Button>
        <Button onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          <Plus size={14} /> Thêm mục
        </Button>
      </header>

      {section.items.length === 0 && !adding ? (
        <EmptyState title="Chương chưa có mục nào" hint="Thêm bài đọc hoặc mục bài tập để member có thứ để làm." />
      ) : (
        <ul>
          {section.items.map((item, i) => (
            <ItemRow
              key={item.id}
              courseId={courseId}
              item={item}
              first={i === 0}
              last={i === section.items.length - 1}
              onMove={(delta) => onMoveItem(i, delta)}
            />
          ))}
        </ul>
      )}

      {adding ? (
        <div className="px-3 pb-3">
          <NewItemForm
            sectionId={section.id}
            problems={problems}
            pending={createItem.isPending}
            onCancel={() => setAdding(false)}
            onCreate={(body) => {
              setError(null)
              createItem.mutate(body, {
                onSuccess: () => setAdding(false),
                onError: (err) => setError(readApiMessage(err, 'Không thêm được mục.')),
              })
            }}
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
      ) : null}
    </section>
  )
}
