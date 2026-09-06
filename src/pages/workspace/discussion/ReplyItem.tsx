/**
 * Một trả lời trong chủ đề: nội dung Markdown + dòng tác giả·giờ, và (nếu được) sửa/xoá.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Markdown } from '@/components/markdown/Markdown'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Composer } from './Composer'
import { formatWhen, type Reply } from './types'

export function ReplyItem({ problemId, reply }: { problemId: string; reply: Reply }) {
  const client = useQueryClient()
  const inval = () => client.invalidateQueries({ queryKey: ['discussion', problemId] })
  const [editing, setEditing] = useState(false)

  const edit = useMutation({
    mutationFn: (bodyMd: string) => api.patch(`/api/member/discussion/reply/${reply.id}`, { bodyMd }),
    onSuccess: () => {
      setEditing(false)
      inval()
    },
  })
  const del = useMutation({
    mutationFn: () => api.del(`/api/member/discussion/reply/${reply.id}`),
    onSuccess: inval,
  })

  return (
    <div className="border-t border-line py-2.5 pl-3">
      <div className="mb-1 flex items-center gap-2 font-mono text-[11px] text-ink-6">
        <span className={cn(reply.isMine ? 'text-moss' : 'text-ink-5')}>{reply.isMine ? 'Bạn' : reply.authorName}</span>
        <span>· {formatWhen(reply.createdAt)}</span>
        {reply.editedAt ? <span>· đã sửa</span> : null}
      </div>
      {editing ? (
        <Composer
          initialBody={reply.bodyMd}
          submitLabel="Lưu"
          pending={edit.isPending}
          autoFocus
          onSubmit={({ bodyMd }) => edit.mutate(bodyMd)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <Markdown source={reply.bodyMd} className="text-[14px]" />
          {reply.canManage ? (
            <div className="mt-1 flex gap-3 font-mono text-[11px] text-ink-6">
              {reply.isMine ? (
                <button type="button" className="hover:text-ink-2" onClick={() => setEditing(true)}>
                  sửa
                </button>
              ) : null}
              <button
                type="button"
                className="hover:text-clay"
                onClick={() => {
                  if (confirm('Xoá trả lời này?')) del.mutate()
                }}
              >
                xoá
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
