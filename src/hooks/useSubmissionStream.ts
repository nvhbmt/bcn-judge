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
    if (!submissionId) {
      setSubmission(null)
      return
    }
    let cancelled = false
    gotEvent.current = false

    const refetch = async () => {
      try {
        const data = await api.get<SubmissionView>(`/api/member/submissions/${submissionId}`)
        if (!cancelled) setSubmission(data)
        return data.status
      } catch {
        return null
      }
    }

    void refetch()

    const source = new EventSource(`/api/member/submissions/${submissionId}/events`, { withCredentials: true })
    source.onmessage = () => {
      gotEvent.current = true
      setLive(true)
      void refetch()
    }
    source.onerror = () => setLive(false)

    // Đường lùi: nếu sau vài giây SSE chưa nói gì thì bật polling song song.
    let poll: ReturnType<typeof setInterval> | null = null
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
      source.close()
    }
  }, [submissionId])

  return { submission, live }
}
