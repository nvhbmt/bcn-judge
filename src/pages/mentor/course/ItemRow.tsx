/** Một mục trong chương: đổi thứ tự, sửa, xuất bản, xoá (FR-C1, FR-C3). */
import { useState } from 'react'
import { ArrowDown, ArrowUp, BookOpen, Code2, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { Notice } from '@/pages/mentor/fields'
import { PublishGateNotice } from '@/pages/mentor/PublishGateNotice'
import { ItemEditor } from './ItemEditor'
import type { SyllabusItem } from '@/pages/mentor/mentorTypes'
import { readApiMessage, readPublishGate, type PublishGate } from '@/pages/mentor/publishGate'
import { useItemMutations } from '@/pages/mentor/useCourseContent'
import { cn } from '@/lib/cn'

export function ItemRow({
  courseId,
  item,
  first,
  last,
  onMove,
}: {
  courseId: string
  item: SyllabusItem
  first: boolean
  last: boolean
  onMove: (delta: -1 | 1) => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [gate, setGate] = useState<PublishGate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { save, publish, remove } = useItemMutations(courseId)
  const published = item.status === 'published'

  function doPublish(confirm?: boolean) {
    setError(null)
    // Không đoán trước kết quả: gửi thẳng, để server quyết cổng nào chặn rồi
    // readPublishGate() phân loại mềm/cứng theo mã trả về.
    publish.mutate({ itemId: item.id, ...(confirm ? { confirm } : {}) }, {
      onSuccess: () => setGate(null),
      onError: (err) => setGate(readPublishGate(err)),
    })
  }

  return (
    <li className="border-t border-line px-3 py-2 first:border-t-0">
      <div className="flex items-center gap-2">
        <span className="text-ink-6" title={item.kind === 'lesson' ? 'Bài đọc' : 'Bài tập'}>
          {item.kind === 'lesson' ? <BookOpen size={15} /> : <Code2 size={15} />}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>

        <span
          className={cn(
            'px-1.5 py-0.5 text-xs',
            published ? 'bg-surface-sel text-moss' : 'bg-surface-sel text-ink-3',
          )}
        >
          {published ? 'Xuất bản' : 'Nháp'}
        </span>

        <Button
          onClick={() => onMove(-1)}
          disabled={first}
          aria-label={`Đưa mục ${item.title} lên trên`}
          className="px-1.5"
        >
          <ArrowUp size={14} />
        </Button>
        <Button
          onClick={() => onMove(1)}
          disabled={last}
          aria-label={`Đưa mục ${item.title} xuống dưới`}
          className="px-1.5"
        >
          <ArrowDown size={14} />
        </Button>
        <Button onClick={() => setEditing((v) => !v)} aria-label={`Sửa mục ${item.title}`} className="px-1.5">
          <Pencil size={14} />
        </Button>
        <Button
          variant={published ? 'ghost' : 'primary'}
          disabled={publish.isPending || save.isPending}
          onClick={() =>
            published
              ? save.mutate(
                  { itemId: item.id, body: { status: 'draft' } },
                  { onError: (err) => setError(readApiMessage(err, 'Không chuyển về nháp được.')) },
                )
              : doPublish()
          }
        >
          {published ? 'Ẩn đi' : 'Xuất bản'}
        </Button>
        <Button
          variant="danger"
          onClick={() => setConfirmDelete(true)}
          aria-label={`Xoá mục ${item.title}`}
          className="px-1.5"
        >
          <Trash2 size={14} />
        </Button>
      </div>

      {confirmDelete ? (
        <div className="mt-2 flex items-center gap-2 bg-surface-1 px-3 py-2 text-sm">
          <span className="flex-1">Xoá “{item.title}”? Không hoàn tác được.</span>
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => {
              setError(null)
              remove.mutate(item.id, {
                onSuccess: () => setConfirmDelete(false),
                // 409 `item_in_use`: mục đã có bài nộp — đây là quy tắc nghiệp vụ
                // (giữ lịch sử chấm), không phải sự cố; hiện lời nhắn của server.
                onError: (err) => setError(readApiMessage(err, 'Không xoá được mục.')),
              })
            }}
          >
            {remove.isPending ? 'Đang xoá…' : 'Xoá'}
          </Button>
          <Button onClick={() => setConfirmDelete(false)}>Huỷ</Button>
        </div>
      ) : null}

      {editing ? (
        <ItemEditor
          item={item}
          pending={save.isPending}
          onCancel={() => setEditing(false)}
          onSave={(body) => {
            setError(null)
            save.mutate(
              { itemId: item.id, body },
              {
                onSuccess: () => setEditing(false),
                onError: (err) => setError(readApiMessage(err, 'Không lưu được mục.')),
              },
            )
          }}
        />
      ) : null}

      {gate ? (
        <PublishGateNotice
          gate={gate}
          pending={publish.isPending}
          onConfirm={() => doPublish(true)}
          onDismiss={() => setGate(null)}
        />
      ) : null}
      {error ? (
        <div className="mt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
    </li>
  )
}
