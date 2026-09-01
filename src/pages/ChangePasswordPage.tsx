import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui'
import { useAuth } from '@/stores/auth'

/** FR-A2/A3: bắt đổi mật khẩu ở lần đăng nhập đầu. */
export function ChangePasswordPage() {
  const { changePassword, error, logout } = useAuth()
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const mismatch = confirm.length > 0 && confirm !== newPassword

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (mismatch) return
    setBusy(true)
    await changePassword(currentPassword, newPassword)
    setBusy(false)
  }

  return (
    <div className="grid h-full place-items-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm border border-line bg-surface-2 p-6"
      >
        <h1 className="font-display text-[22px] text-ink-1">Đổi mật khẩu</h1>
        <p className="mt-1 mb-5 text-sm text-ink-5">
          Mật khẩu hiện tại do quản trị viên cấp — đổi trước khi dùng tiếp.
        </p>

        {[
          { id: 'cur', label: 'Mật khẩu hiện tại', value: currentPassword, set: setCurrent, ac: 'current-password' },
          { id: 'new', label: 'Mật khẩu mới (tối thiểu 8 ký tự)', value: newPassword, set: setNext, ac: 'new-password' },
          { id: 'cfm', label: 'Nhập lại mật khẩu mới', value: confirm, set: setConfirm, ac: 'new-password' },
        ].map((f) => (
          <div key={f.id} className="mb-3">
            <label className="block text-sm font-medium" htmlFor={f.id}>
              {f.label}
            </label>
            <input
              id={f.id}
              type="password"
              value={f.value}
              autoComplete={f.ac}
              required
              minLength={f.id === 'cur' ? 1 : 8}
              onChange={(e) => f.set(e.target.value)}
              className="mt-1 w-full border border-line-strong px-3 py-2 text-sm"
            />
          </div>
        ))}

        {mismatch ? (
          <p role="alert" className="text-sm text-[var(--color-wa)]">
            Hai mật khẩu mới chưa khớp.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-wa)]">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" disabled={busy || mismatch} className="mt-4 w-full justify-center">
          {busy ? 'Đang lưu…' : 'Đổi mật khẩu'}
        </Button>
        <Button type="button" onClick={() => void logout()} className="mt-2 w-full justify-center">
          Đăng xuất
        </Button>
      </form>
    </div>
  )
}
