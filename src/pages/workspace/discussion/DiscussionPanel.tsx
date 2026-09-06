/**
 * Mục "Thảo luận" của thanh icon — hỏi/đáp cho bài đang mở.
 *
 * CỔNG chống lộ lời giải: server trả canAccess=false khi người xem CHƯA AC bài (và
 * không phải staff); khi đó panel chỉ hiện lời nhắc "giải để mở", KHÔNG có nội dung
 * nào để đọc lỏm. Đã AC (hoặc mentor/admin) thì mở đầy đủ: đặt câu hỏi, trả lời, sửa/xoá.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { useState } from 'react'
import { Button, EmptyState, SectionRule, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { Composer } from './Composer'
import { ThreadCard } from './ThreadCard'
import type { DiscussionData } from './types'

export function DiscussionPanel({ problemId }: { problemId?: string }) {
  const client = useQueryClient()
  const [composing, setComposing] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['discussion', problemId],
    queryFn: () => api.get<DiscussionData>(`/api/member/discussion/problem/${problemId}`),
    enabled: Boolean(problemId),
  })

  const create = useMutation({
    mutationFn: (v: { title: string; bodyMd: string }) =>
      api.post(`/api/member/discussion/problem/${problemId}`, v),
    onSuccess: () => {
      setComposing(false)
      void client.invalidateQueries({ queryKey: ['discussion', problemId] })
    },
  })

  if (!problemId) return <EmptyState title="Không có thảo luận ở đây" />
  if (isLoading || !data) {
    return (
      <div className="p-4">
        <Spinner />
      </div>
    )
  }

  if (!data.canAccess) {
    return (
      <div className="px-4 py-10">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
          <Lock size={28} className="text-ink-5" />
          <p className="font-display text-[19px] text-ink-1">Giải được bài để mở thảo luận</p>
          <p className="text-[14px] text-ink-4">
            Thảo luận của mỗi bài chỉ mở sau khi bạn nộp được lời giải Chấp nhận (AC) — để không lộ
            hướng làm cho người chưa thử.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <SectionRule label="Thảo luận" meta={`${data.threads.length} chủ đề`} />
        </div>
        {!composing ? (
          <Button variant="primary" className="shrink-0" onClick={() => setComposing(true)}>
            Đặt câu hỏi
          </Button>
        ) : null}
      </div>

      {composing ? (
        <div className="mb-4 border border-line bg-surface-2 p-3">
          <Composer
            withTitle
            submitLabel="Đăng chủ đề"
            placeholder="Mô tả rõ chỗ vướng, dán đoạn code hoặc test nếu cần… (Markdown & LaTeX)"
            pending={create.isPending}
            autoFocus
            onSubmit={(v) => create.mutate(v)}
            onCancel={() => setComposing(false)}
          />
        </div>
      ) : null}

      {data.threads.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-ink-5">
          Chưa có chủ đề nào. Mở đầu bằng một câu hỏi hoặc mẹo cho bài này.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.threads.map((t) => (
            <ThreadCard key={t.id} problemId={problemId} thread={t} />
          ))}
        </div>
      )}
    </div>
  )
}
