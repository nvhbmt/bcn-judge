/**
 * FR-D6 — chạy lời giải mẫu trên toàn bộ testcase và chờ kết quả.
 *
 * Vì sao POLL chứ không SSE như `useSubmissionStream`: lượt kiểm chạy dưới danh
 * nghĩa chính mentor (`enqueue({userId: me.id})`), nên đọc lại được qua
 * `GET /api/member/submissions/:id` — nhưng một lượt kiểm là việc BẤM MỘT LẦN rồi
 * chờ, không phải luồng sống suốt phiên. Mở EventSource cho nó tốn một kết nối
 * treo mà đổi lại vài trăm ms; polling 1,5 giây rẻ hơn và không có đường lỗi
 * "SSE bị middlebox chặn" phải xử lý.
 *
 * Hai cái bẫy đã tính trước:
 *   - `enqueue` XOÁ mọi lượt `run` đang chờ của cùng người. Bấm kiểm lần hai khi
 *     lần một chưa chấm xong thì lần một biến mất khỏi hàng đợi và mãi không
 *     'done'. `runIdRef` vì thế là nguồn sự thật: vòng lặp cũ thấy id đã đổi thì
 *     tự rút, không ghi đè kết quả của lượt mới.
 *   - StrictMode của React 19 gọi effect hai lần; `aliveRef` phải được BẬT LẠI ở
 *     thân effect, không chỉ tắt ở cleanup.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiFailure } from '@/lib/api'
import type { SubmissionView } from '@/types/api'

const POLL_MS = 1500
/** ~2,5 phút. Quá mốc này thì hàng đợi hoặc worker có vấn đề, không phải bài chậm. */
const MAX_POLLS = 100

export interface ValidateRun {
  phase: 'idle' | 'waiting' | 'done' | 'error'
  submission: SubmissionView | null
  error: string | null
}

const IDLE: ValidateRun = { phase: 'idle', submission: null, error: null }

export function useValidateRun(problemId: string | undefined, onFinished?: () => void) {
  const [run, setRun] = useState<ValidateRun>(IDLE)
  const aliveRef = useRef(true)
  const runIdRef = useRef<string | null>(null)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  const start = useCallback(async () => {
    if (!problemId) return
    setRun({ phase: 'waiting', submission: null, error: null })
    try {
      const { id } = await api.post<{ id: string }>(`/api/mentor/problems/${problemId}/validate`)
      runIdRef.current = id

      for (let i = 0; i < MAX_POLLS; i += 1) {
        await sleep(POLL_MS)
        if (!aliveRef.current || runIdRef.current !== id) return
        const submission = await api.get<SubmissionView>(`/api/member/submissions/${id}`)
        if (!aliveRef.current || runIdRef.current !== id) return
        if (submission.status === 'done') {
          setRun({ phase: 'done', submission, error: null })
          onFinished?.()
          return
        }
        // Verdict từng testcase nhỏ giọt vào đây, nên bảng kết quả dựng dần chứ
        // không đứng im rồi hiện một cục.
        setRun({ phase: 'waiting', submission, error: null })
      }
      setRun({
        phase: 'error',
        submission: null,
        error: 'Chờ quá lâu chưa có kết quả. Kiểm tra hàng đợi chấm rồi thử lại.',
      })
    } catch (err) {
      if (!aliveRef.current) return
      setRun({
        phase: 'error',
        submission: null,
        error: err instanceof ApiFailure ? err.error.message : 'Không gửi được lượt kiểm.',
      })
    }
  }, [problemId, onFinished])

  /** Đổi bài / thay bộ test → kết quả cũ nói về bộ test cũ, phải bỏ đi. */
  const reset = useCallback(() => {
    runIdRef.current = null
    setRun(IDLE)
  }, [])

  return { run, start, reset }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
