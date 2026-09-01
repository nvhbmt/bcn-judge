/**
 * FR-F4: verdict từng testcase cập nhật trực tiếp.
 *
 * SSE là đường chính; nếu trình duyệt/middlebox chặn thì tự hạ xuống **polling
 * 2 giây** — chức năng vẫn đúng, chỉ chậm hơn (đúng đường lùi của design §4.3).
 */
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import type { SubmissionView } from '@/types/api'

const POLL_MS = 2000
const SSE_GRACE_MS = 4000

export function useSubmissionStream(submissionId: string | null): {
  submission: SubmissionView | null
  live: boolean
} {
  const [submission, setSubmission] = useState<SubmissionView | null>(null)
  const [live, setLive] = useState(false)
  const gotEvent = useRef(false)

  useEffect(() => {
    // Xoá kết quả cũ ở MỌI lần đổi id, không chỉ khi về null: giữ lại thì trong khoảng
    // giữa lúc bấm và lúc phản hồi đầu tiên về, màn hình đang hiện kết quả của một bài
    // nộp KHÁC — mà nó trông y hệt kết quả của cú bấm vừa rồi.
    setSubmission(null)
    if (!submissionId) return
    let cancelled = false
    gotEvent.current = false

    let source: EventSource | null = null
    let poll: ReturnType<typeof setInterval> | null = null

    const refetch = async () => {
      try {
        const data = await api.get<SubmissionView>(`/api/member/submissions/${submissionId}`)
        if (!cancelled) setSubmission(data)
        // Chấm xong thì đóng kết nối, thay vì để nó treo tới lúc rời trang. Máy chủ
        // KHÔNG tự khép luồng (`sseStream` giữ kênh mở vô hạn), nên nếu client không
        // đóng thì không ai đóng. Màn làm bài mở tới ba luồng — lần nộp, lượt chạy mẫu,
        // lượt chạy tự nhập — và mỗi lượt bấm để lại thêm một kết nối sống: chỉ vài lần
        // là chạm trần 6 kết nối/tên miền của HTTP/1.1, rồi mọi request sau đứng chờ.
        //
        // Đánh đổi: bài đã "done" mà mentor cho chấm lại thì màn hình không tự cập
        // nhật nữa. Chấp nhận được vì đường lùi polling vốn đã dừng ở 'done' từ trước,
        // nên đóng SSE chỉ là làm hai đường xử sự giống nhau.
        if (data.status === 'done') {
          source?.close()
          if (poll) clearInterval(poll)
        }
        return data.status
      } catch {
        return null
      }
    }

    void refetch()

    source = new EventSource(`/api/member/submissions/${submissionId}/events`, { withCredentials: true })

    const onEvent = () => {
      gotEvent.current = true
      setLive(true)
      void refetch()
    }

    /*
     * Máy chủ gửi sự kiện CÓ TÊN: `sse.ts` đặt tên bằng `payload.kind`, và khi payload
     * không có `kind` — đúng trường hợp của bài nộp — thì rơi về TÊN KÊNH. Mà
     * `EventSource.onmessage` chỉ nổ với sự kiện KHÔNG tên, nên bản trước không bao giờ
     * nhận được gì.
     *
     * Hỏng hoàn toàn câm: đường lùi polling 2 giây vẫn đưa verdict về, chỉ chậm hơn —
     * nên FR-F4 ("verdict từng testcase cập nhật trực tiếp") thực ra chưa từng chạy trên
     * trình duyệt, và không có gì báo. Đo được: worker chấm xong ở ~520 ms nhưng giao
     * diện tới ~6070 ms mới biết, đúng bằng 4 giây chờ ân hạn cộng một nhịp poll.
     *
     * Vẫn gắn `onmessage` kèm theo: payload có `kind` sẽ mang tên khác tên kênh, và một
     * handler thừa rẻ hơn nhiều so với việc im lặng bỏ lỡ lần nữa.
     */
    source.addEventListener(`submission:${submissionId}`, onEvent)
    source.onmessage = onEvent
    source.onerror = () => setLive(false)

    // Đường lùi: nếu sau vài giây SSE chưa nói gì thì bật polling song song.
    const grace = setTimeout(() => {
      if (gotEvent.current) return
      poll = setInterval(async () => {
        const status = await refetch()
        if (status === 'done' && poll) clearInterval(poll)
      }, POLL_MS)
    }, SSE_GRACE_MS)

    return () => {
      cancelled = true
      clearTimeout(grace)
      if (poll) clearInterval(poll)
      source?.close()
    }
  }, [submissionId])

  return { submission, live }
}
