/**
 * Ghi chú leader gửi cho tôi, hiện ở đầu khung nội dung màn làm bài (FR-J6).
 *
 * Bản vẽ nói rõ chỗ đọc: "Leader ghi chú ở đây, thành viên mở workspace là thấy". Đặt
 * ở đây chứ không phải trang chủ vì ghi chú gần như luôn là "bài này làm tới đâu rồi" —
 * đọc nó ngay lúc sắp làm bài mới có tác dụng.
 *
 * Chỉ hiện ghi chú CHƯA ĐỌC. Bấm "đã đọc" là ẩn hẳn: một lời nhắc cứ đứng đó mãi thì
 * lần thứ ba người ta không còn nhìn nữa.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface Note {
  id: string
  body: string
  createdAt: string
  readAt: string | null
  authorName: string
  teamName: string
}

export function NoteBanner() {
  const client = useQueryClient()
  const { data } = useQuery({
    queryKey: ['member', 'notes', 'mine'],
    queryFn: () => api.get<Note[]>('/api/member/teams/notes/mine'),
  })
  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/api/member/teams/notes/${id}/read`, {}),
    onSuccess: () => client.invalidateQueries({ queryKey: ['member', 'notes', 'mine'] }),
  })

  const unread = (data ?? []).filter((n) => n.readAt === null)
  if (unread.length === 0) return null

  return (
    <div className="border-b border-line">
      {unread.map((n) => (
        <div key={n.id} className="flex items-start gap-3 border-l-2 border-earth bg-(--tint-earth) px-4 py-2.5">
          <p className="min-w-0 flex-1 text-[13px] text-ink-2">
            <span className="font-mono text-[13px] text-ink-5">
              {n.authorName} · {n.teamName}
            </span>
            <span className="mt-0.5 block">{n.body}</span>
          </p>
          <button
            type="button"
            onClick={() => markRead.mutate(n.id)}
            disabled={markRead.isPending}
            className="shrink-0 font-mono text-[13px] text-ink-5 hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
          >
            đã đọc
          </button>
        </div>
      ))}
    </div>
  )
}
