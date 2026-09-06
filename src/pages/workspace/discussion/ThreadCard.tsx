/**
 * Một CHỦ ĐỀ thảo luận: đề bài hỏi (tiêu đề + nội dung) rồi các trả lời một cấp.
 *
 * Ghim (📌) do mentor/admin đặt, nổi lên đầu danh sách. Tác giả sửa/xoá bài mình;
 * staff xoá bất kỳ. Mọi hành động xong thì làm mới ['discussion', problemId].
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pin } from 'lucide-react'
import { useState } from 'react'
import { Markdown } from '@/components/markdown/Markdown'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Composer } from './Composer'
import { ReplyItem } from './ReplyItem'
import { formatWhen, type Thread } from './types'

export function ThreadCard({ problemId, thread }: { problemId: string; thread: Thread }) {
  const client = useQueryClient()
  const inval = () => client.invalidateQueries({ queryKey: ['discussion', problemId] })
  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)

  const reply = useMutation({
    mutationFn: (bodyMd: string) => api.post(`/api/member/discussion/thread/${thread.id}/reply`, { bodyMd }),
    onSuccess: () => {
      setReplying(false)
      inval()
    },
  })
  const edit = useMutation({
    mutationFn: (v: { title: string; bodyMd: string }) => api.patch(`/api/member/discussion/thread/${thread.id}`, v),
    onSuccess: () => {
      setEditing(false)
      inval()
    },
  })
  const del = useMutation({
    mutationFn: () => api.del(`/api/member/discussion/thread/${thread.id}`),
    onSuccess: inval,
  })
  const pin = useMutation({
    mutationFn: () => api.post(`/api/member/discussion/thread/${thread.id}/pin`, { pinned: !thread.pinned }),
    onSuccess: inval,
  })

  return (
    <article className={cn('border bg-surface-1', thread.pinned ? 'border-brass' : 'border-line')}>
      <div className="border-b border-line px-4 py-3">
        {editing ? (
          <Composer
            withTitle
            initialTitle={thread.title}
            initialBody={thread.bodyMd}
            submitLabel="Lưu"
            pending={edit.isPending}
            onSubmit={(v) => edit.mutate(v)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <div className="flex items-start gap-2">
              {thread.pinned ? <Pin size={15} className="mt-1 shrink-0 text-brass" aria-label="Đã ghim" /> : null}
              <h3 className="min-w-0 flex-1 font-display text-[19px] text-ink-1">{thread.title}</h3>
            </div>
            <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-ink-6">
              <span className={cn(thread.isMine ? 'text-moss' : 'text-ink-5')}>
                {thread.isMine ? 'Bạn' : thread.authorName}
              </span>
              <span>· {formatWhen(thread.createdAt)}</span>
              {thread.editedAt ? <span>· đã sửa</span> : null}
            </div>
            <Markdown source={thread.bodyMd} className="mt-2 text-[14px]" />
            <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-ink-6">
              <button type="button" className="hover:text-ink-2" onClick={() => setReplying((v) => !v)}>
                trả lời
              </button>
              {thread.isMine ? (
                <button type="button" className="hover:text-ink-2" onClick={() => setEditing(true)}>
                  sửa
                </button>
              ) : null}
              {thread.canManage ? (
                <button
                  type="button"
                  className="hover:text-clay"
                  onClick={() => {
                    if (confirm('Xoá chủ đề này (kèm mọi trả lời)?')) del.mutate()
                  }}
                >
                  xoá
                </button>
              ) : null}
              {thread.canPin ? (
                <button type="button" className="hover:text-brass" onClick={() => pin.mutate()}>
                  {thread.pinned ? 'bỏ ghim' : 'ghim'}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Khối TRẢ LỜI là cấp con của chủ đề: xuống nền surface-2 và thụt vào sau một
          thanh dọc bên trái, để mắt thấy ngay "những cái này thuộc bài trên", không
          lẫn thành bài ngang hàng. */}
      {thread.replies.length > 0 || replying ? (
        <div className="bg-surface-2 px-4 py-3">
          <div className="border-l-2 border-line-strong pl-4">
            {thread.replies.length > 0 ? (
              <div className="mb-0.5 font-mono text-[11px] tracking-[0.08em] text-ink-6">
                {thread.replies.length} trả lời
              </div>
            ) : null}
            {thread.replies.map((r) => (
              <ReplyItem key={r.id} problemId={problemId} reply={r} />
            ))}
            {replying ? (
              <div className="border-t border-line pt-3">
                <Composer
                  submitLabel="Gửi trả lời"
                  placeholder="Trả lời… (Markdown & LaTeX)"
                  pending={reply.isPending}
                  autoFocus
                  onSubmit={({ bodyMd }) => reply.mutate(bodyMd)}
                  onCancel={() => setReplying(false)}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  )
}
