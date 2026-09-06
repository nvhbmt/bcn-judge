/**
 * Cổng mở hộp thoại mừng AC (SolvedDialog).
 *
 * Tách khỏi WorkspacePage vì đây là một mẩu trạng thái tự chứa — "một lượt NỘP trả
 * AC thì mở hộp thoại đúng MỘT lần" — không dính gì tới bố cục màn hình. `celebrated`
 * giữ id đã mừng: stream cập nhật submission nhiều nhịp (judging → done) và effect
 * chạy mỗi nhịp, nên nếu không chốt theo id thì hộp thoại nhấp nháy lại mỗi lần render.
 *
 * Đổi bài (`handle` đổi) thì quên id cũ để lượt nộp ở bài mới mừng lại được.
 */
import { useEffect, useRef, useState } from 'react'
import type { SubmissionView } from '@/types/api'

export function useSolvedDialog(
  submission: SubmissionView | null,
  watchedId: string | null,
  handle: string | undefined,
): { open: boolean; close: () => void } {
  const [open, setOpen] = useState(false)
  const celebrated = useRef<string | null>(null)

  useEffect(() => {
    setOpen(false)
    celebrated.current = null
  }, [handle])

  useEffect(() => {
    if (!submission || submission.id !== watchedId) return
    if (submission.status !== 'done' || submission.verdict !== 'AC') return
    if (celebrated.current === submission.id) return
    celebrated.current = submission.id
    setOpen(true)
  }, [submission, watchedId])

  return { open, close: () => setOpen(false) }
}
