/**
 * Đổi mật khẩu — dùng cho CẢ HAI lối vào:
 *   - bắt buộc: mật khẩu do admin cấp, chưa đổi thì không đi đâu được (FR-A2/A3);
 *   - tự nguyện: từ menu tài khoản, lúc nào cũng đổi được.
 *
 * Một trang chứ không phải hai, vì hai lối chỉ khác nhau ở lời dẫn và ở đường lui:
 * đang bị chặn thì lối lui duy nhất là đăng xuất, còn tự vào thì quay lại chỗ cũ.
 *
 * Đổi mật khẩu THU HỒI mọi phiên khác (server: revokeAllSessionsOf). Đó là hệ quả thật
 * và người ta cần biết trước khi bấm, nên nó được nói ra chứ không để tự phát hiện khi
 * điện thoại bỗng đăng xuất.
 */
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, PasswordEye } from '@/components/ui'
import { useAuth } from '@/stores/auth'

export function ChangePasswordPage() {
  const { me, changePassword, error, logout } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [xong, setXong] = useState(false)
  const mismatch = confirm.length > 0 && confirm !== newPassword

  // Cờ này TẮT ngay khi đổi xong, nên phải chốt lúc vào trang: đọc sau khi đổi thì
  // lối bắt buộc bỗng thành lối tự nguyện ngay giữa lúc đang xử lý kết quả.
  const [batBuoc] = useState(() => me?.mustChangePassword ?? false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (mismatch) return
    setBusy(true)
    const ok = await changePassword(currentPassword, newPassword)
    setBusy(false)
    if (!ok) return

    // Bị BẮT đổi thì vào thẳng app: người ta không định làm việc này, hệ thống chặn
    // đường nên mới phải làm — xong là trả lại chỗ họ đang muốn tới, không bắt bấm
    // thêm một nút xác nhận nữa. Tự vào thì ngược lại: không có màn báo thì bấm xong
    // màn hình y như cũ, không biết đã đổi được hay chưa.
    if (batBuoc) navigate('/', { replace: true })
    else setXong(true)
  }

  if (xong) {
    return (
      <Khung>
        <h1 className="font-display text-[22px] text-ink-1">Đã đổi mật khẩu</h1>
        <p className="mt-1 mb-5 text-sm text-ink-5">
          Lần sau đăng nhập bằng mật khẩu mới. Các thiết bị khác đang đăng nhập tài khoản này đã bị
          đăng xuất; máy hiện tại thì không.
        </p>
        <Link to="/" className="block">
          <Button type="button" variant="primary" className="w-full justify-center">
            Về trang chủ
          </Button>
        </Link>
      </Khung>
    )
  }

  return (
    <Khung onSubmit={onSubmit}>
      <h1 className="font-display text-[22px] text-ink-1">Đổi mật khẩu</h1>
      <p className="mt-1 mb-5 text-sm text-ink-5">
        {batBuoc
          ? 'Mật khẩu hiện tại do quản trị viên cấp — đổi trước khi dùng tiếp.'
          : 'Đổi xong, mọi thiết bị khác đang đăng nhập tài khoản này sẽ bị đăng xuất.'}
      </p>

      {[
        { id: 'cur', label: 'Mật khẩu hiện tại', value: currentPassword, set: setCurrent, ac: 'current-password' },
        { id: 'new', label: 'Mật khẩu mới (tối thiểu 8 ký tự)', value: newPassword, set: setNext, ac: 'new-password' },
        { id: 'cfm', label: 'Nhập lại mật khẩu mới', value: confirm, set: setConfirm, ac: 'new-password' },
      ].map((f) => (
        <OMatKhau key={f.id} {...f} minLength={f.id === 'cur' ? 1 : 8} />
      ))}

      {mismatch ? (
        <p role="alert" className="text-sm text-wa">
          Hai mật khẩu mới chưa khớp.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-wa">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={busy || mismatch} className="mt-4 w-full justify-center">
        {busy ? 'Đang lưu…' : 'Đổi mật khẩu'}
      </Button>

      {/* Đang bị chặn thì lối ra duy nhất là đăng xuất; tự vào thì có chỗ để về. */}
      {batBuoc ? (
        <Button type="button" onClick={() => void logout()} className="mt-2 w-full justify-center">
          Đăng xuất
        </Button>
      ) : (
        <Link to="/" className="mt-2 block">
          <Button type="button" className="w-full justify-center">
            Quay lại
          </Button>
        </Link>
      )}
    </Khung>
  )
}

/**
 * Một ô mật khẩu kèm con mắt bật/tắt.
 *
 * Tách thành component RIÊNG chứ không giữ một Set id đang mở ở trang: mỗi ô tự giữ
 * trạng thái của mình, nên bật ô "mật khẩu hiện tại" không kéo theo hai ô mới lộ ra.
 *
 * Con mắt nằm TRONG khung viền (absolute) và ô chừa `pr-10`: đặt ngoài thì ba ô so
 * le nhau vì nhãn dài ngắn khác nhau, còn không chừa lề thì mật khẩu dài chui xuống
 * dưới icon.
 */
function OMatKhau({
  id,
  label,
  value,
  set,
  ac,
  minLength,
}: {
  id: string
  label: string
  value: string
  set: (v: string) => void
  ac: string
  minLength: number
}) {
  const [hien, setHien] = useState(false)

  return (
    <div className="mb-3">
      <label className="block text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          type={hien ? 'text' : 'password'}
          value={value}
          autoComplete={ac}
          required
          minLength={minLength}
          onChange={(e) => set(e.target.value)}
          className="w-full border border-line-strong py-2 pr-10 pl-3 text-sm"
        />
        <span className="absolute top-1/2 right-1.5 -translate-y-1/2">
          <PasswordEye shown={hien} onToggle={() => setHien((v) => !v)} />
        </span>
      </div>
    </div>
  )
}

function Khung({ children, onSubmit }: { children: React.ReactNode; onSubmit?: (e: FormEvent) => void }) {
  const cls = 'w-full max-w-sm border border-line bg-surface-2 p-6'
  return (
    <div className="grid h-full place-items-center px-4 py-8">
      {onSubmit ? (
        <form onSubmit={onSubmit} className={cls}>
          {children}
        </form>
      ) : (
        <div className={cls}>{children}</div>
      )}
    </div>
  )
}
