/**
 * Mật khẩu ban đầu — hiển thị ĐÚNG MỘT LẦN (FR-A2/A3).
 *
 * Server chỉ lưu hash, nên chuỗi này không tồn tại ở đâu khác sau khi phản hồi
 * kết thúc: đóng bảng mà chưa chép là phải đặt lại mật khẩu lần nữa. Vì thế
 * bảng cố ý "khó bỏ qua": nền cảnh báo, `role="alert"` để trình đọc màn hình
 * đọc ngay, mật khẩu ở cỡ chữ lớn font mono, và nút đóng ghi rõ hậu quả thay vì
 * chỉ một dấu ×. Cũng vì thế bảng KHÔNG tự đóng theo thời gian.
 */
import { KeyRound, X } from 'lucide-react'
import { useRef, useEffect } from 'react'
import { Button } from '@/components/ui'
import { CopyButton } from './ui'

export interface OneTimeSecretData {
  email: string
  password: string
  /** Phân biệt câu chữ giữa "vừa tạo tài khoản" và "vừa đặt lại mật khẩu". */
  kind: 'created' | 'reset'
}

export function OneTimeSecret({ data, onDismiss }: { data: OneTimeSecretData; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  // Kéo tiêu điểm về bảng: sau khi bấm "Tạo" ở cuối form dài, mật khẩu hiện ở
  // trên cùng rất dễ nằm ngoài màn hình và bị bỏ sót.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' })
    ref.current?.focus()
  }, [data])

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="mb-4 border-2 border-[var(--color-tle)] bg-[var(--tint-earth)] p-4"
    >
      <div className="mb-2 flex items-center gap-2">
        <KeyRound size={16} className="text-[var(--color-tle)]" />
        <h2 className="text-sm font-semibold text-earth">
          {data.kind === 'created' ? 'Tài khoản đã tạo — mật khẩu ban đầu' : 'Mật khẩu mới đã đặt lại'}
        </h2>
        <Button variant="ghost" onClick={onDismiss} className="ml-auto" aria-label="Đóng, tôi đã lưu mật khẩu">
          <X size={14} /> Tôi đã lưu
        </Button>
      </div>

      <dl className="mb-3 grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
        <dt className="text-xs text-ink-3">Tài khoản</dt>
        <dd className="flex items-center gap-2 font-mono text-sm break-all">
          {data.email}
          <CopyButton value={data.email} label="Chép email" />
        </dd>
        <dt className="text-xs text-ink-3">Mật khẩu</dt>
        <dd className="flex items-center gap-2">
          <code className="bg-surface-2 px-2 py-1 font-mono text-base font-semibold tracking-wide select-all">
            {data.password}
          </code>
          <CopyButton value={data.password} label="Chép mật khẩu" />
          <CopyButton value={`${data.email} / ${data.password}`} label="Chép cả hai" />
        </dd>
      </dl>

      <p className="text-sm text-earth">
        <strong>Chuỗi này không xem lại được.</strong> Hệ thống chỉ lưu bản băm — đóng bảng mà chưa chép thì cách duy
        nhất là đặt lại mật khẩu lần nữa. Người dùng sẽ bị bắt đổi mật khẩu ngay ở lần đăng nhập đầu.
      </p>
    </div>
  )
}
