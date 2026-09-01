/** Băng cảnh báo của cổng xuất bản + băng lỗi chung. */
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui'
import type { PublishGate } from './publishGate'

/**
 * Nút "Vẫn xuất bản" chỉ mọc khi `gate.canConfirm` — tức đúng mã mềm
 * `publish_validation_failed` (xem publishGate.ts). Với cổng cứng
 * (`no_testcases` / `missing_expected` / `no_problems`) chỉ còn lời nhắn: bấm
 * xác nhận cũng vô ích, server chặn trước khi đọc `confirm`.
 */
export function PublishGateNotice({
  gate,
  pending,
  onConfirm,
  onDismiss,
}: {
  gate: PublishGate
  pending?: boolean
  onConfirm: () => void
  onDismiss: () => void
}) {
  const soft = gate.canConfirm
  return (
    <div
      role="alert"
      className={`mt-2 rounded-md px-3 py-2 text-sm ${
        soft
          ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
          : 'bg-red-50 text-[var(--color-wa)] dark:bg-red-950/40'
      }`}
    >
      <p className="flex items-start gap-2">
        {soft ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <ShieldAlert size={15} className="mt-0.5 shrink-0" />}
        <span>{gate.message}</span>
      </p>
      <div className="mt-2 flex gap-2">
        {soft ? (
          <Button variant="primary" onClick={onConfirm} disabled={pending}>
            {pending ? 'Đang xuất bản…' : 'Vẫn xuất bản'}
          </Button>
        ) : null}
        <Button onClick={onDismiss}>{soft ? 'Để sau' : 'Đã hiểu'}</Button>
      </div>
    </div>
  )
}
