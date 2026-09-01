/**
 * Ô ghi chú của leader (FR-J6, màn 06).
 *
 * Backend đã có đủ ba endpoint từ lâu (`POST /teams/:id/notes`, `GET /teams/notes/mine`,
 * `POST /teams/notes/:id/read`) nhưng frontend chưa gọi một cái nào — cả tính năng nằm
 * đó không ai dùng được. Bản vẽ màn 06 có đúng khối này.
 *
 * Đây là mutation DUY NHẤT leader có (xem docstring của routes/member/teams.ts): họ
 * không sửa được điểm, tiến độ hay thành viên. Ghi chú chỉ TẠO dữ liệu mới của chính
 * họ, nên không cần cảnh báo phá dữ liệu.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, SectionRule } from '@/components/ui'
import { api } from '@/lib/api'

export function LeaderNote({
  teamId,
  members,
}: {
  teamId: string
  members: { id: string; displayName: string; isLeader: boolean }[]
}) {
  const client = useQueryClient()
  const [target, setTarget] = useState('')
  const [body, setBody] = useState('')
  const [done, setDone] = useState(false)

  const send = useMutation({
    mutationFn: () => api.post(`/api/member/teams/${teamId}/notes`, { targetUserId: target, body: body.trim() }),
    onSuccess: () => {
      setBody('')
      setDone(true)
      void client.invalidateQueries({ queryKey: ['team', teamId, 'notes'] })
    },
  })

  const canSend = target !== '' && body.trim().length > 0 && !send.isPending

  return (
    <section className="mb-8">
      <SectionRule label="Ghi chú cho thành viên" />
      <div className="mt-3 border border-line bg-surface-2 p-4">
        <p className="mb-3 text-[13px] text-ink-4">
          Leader ghi chú ở đây, thành viên mở màn làm bài là thấy.
        </p>

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <select
            aria-label="Gửi cho"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value)
              setDone(false)
            }}
            className="shrink-0 border border-line-strong bg-surface-2 px-2.5 py-2 font-mono text-[12px] text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-moss"
          >
            <option value="">gửi cho…</option>
            {members
              .filter((m) => !m.isLeader)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
          </select>

          <input
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              setDone(false)
            }}
            maxLength={2000}
            placeholder="Tuần này chưa nộp bài nào — cần giúp gì không?"
            aria-label="Nội dung ghi chú"
            className="min-w-0 flex-1 border border-line-strong bg-surface-2 px-2.5 py-2 text-[13px] text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-moss"
          />

          <Button variant="primary" onClick={() => send.mutate()} disabled={!canSend} className="shrink-0">
            {send.isPending ? 'Đang gửi…' : 'Viết ghi chú'}
          </Button>
        </div>

        {send.isError ? (
          <p role="alert" className="mt-2.5 text-[12px] text-clay">
            Không gửi được. Thử lại sau vài giây.
          </p>
        ) : null}
        {done ? <p className="mt-2.5 font-mono text-[11px] text-moss">Đã gửi.</p> : null}
      </div>
    </section>
  )
}
