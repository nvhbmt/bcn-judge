/**
 * Banner thông báo toàn hệ thống (FR-H5) — "bảo trì 22:00", "hoãn contest tuần này".
 *
 * Đặt ngay dưới thanh trên, TRƯỚC nội dung: thông báo kiểu này chỉ có nghĩa nếu người
 * ta đọc được nó trước khi bắt đầu làm việc.
 *
 * `role="status"` chứ không `alert`: đây là tin cần biết, không phải lỗi vừa xảy ra —
 * `alert` cắt ngang trình đọc màn hình giữa câu đang đọc.
 *
 * Đóng được, và nhớ ĐÚNG nội dung đã đóng trong `localStorage`: đóng một thông báo
 * rồi thì nó im, nhưng admin đổi sang thông báo khác là hiện lại. Nhớ theo cờ
 * "đã đóng" trơn thì thông báo thứ hai không bao giờ tới được ai.
 */
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState } from 'react'

const KHOA = 'bcn.announcement.dismissed'

function daDong(): string {
  try {
    return window.localStorage.getItem(KHOA) ?? ''
  } catch {
    return '' // Safari private mode ném ngay khi đọc.
  }
}

export function Announcement() {
  const [dong, setDong] = useState(daDong)
  const { data } = useQuery({
    queryKey: ['announcement'],
    queryFn: async () => {
      const res = await fetch('/api/member/announcement', {
        headers: { 'x-api-response-version': '2' },
        credentials: 'same-origin',
      })
      if (!res.ok) return { text: '' }
      const body = (await res.json()) as { data?: { text?: string } }
      return { text: body.data?.text ?? '' }
    },
    // Thông báo bảo trì phải tới được người đang mở tab sẵn, nên có nhịp kiểm lại.
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const text = data?.text ?? ''
  if (!text || text === dong) return null

  return (
    <div
      role="status"
      className="flex items-start gap-3 border-b border-earth bg-(--tint-earth) px-7 py-2 text-[14px] text-ink-2"
    >
      <p className="min-w-0 flex-1">{text}</p>
      <button
        type="button"
        aria-label="Đóng thông báo"
        onClick={() => {
          try {
            window.localStorage.setItem(KHOA, text)
          } catch {
            /* Không nhớ được thì thôi — đóng trong phiên này vẫn phải chạy. */
          }
          setDong(text)
        }}
        className="shrink-0 p-0.5 text-ink-5 hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
      >
        <X size={15} />
      </button>
    </div>
  )
}
