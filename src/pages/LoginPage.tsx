/**
 * Màn 01 của bản v2: bảng log bên trái, form bên phải.
 *
 * Ô nhập có dấu nhắc `>` đứng trước — chữ ký của hệ thiết kế, và cũng là thứ nói
 * cho người dùng biết đây là chỗ gõ. Nút "hiện" mật khẩu có vì người ta gõ mật
 * khẩu admin cấp (10 ký tự ngẫu nhiên) trên bàn phím laptop lúc 11 giờ đêm.
 */
import { useState, type FormEvent } from 'react'
import logo from '@/assets/logo-bcn.png'
import { Button } from '@/components/ui'
import { useAuth } from '@/stores/auth'
import { SystemLog } from './login/SystemLog'

function PromptInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  trailing,
}: {
  id: string
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  trailing?: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block font-mono text-[11px] tracking-[0.14em] text-ink-6 uppercase" htmlFor={id}>
        {label}
      </label>
      <div className="flex items-center border border-line-strong bg-surface-2 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-moss">
        <span aria-hidden className="pl-2.5 font-mono text-[13px] text-moss">
          &gt;
        </span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className="w-full bg-transparent px-2 py-2 font-mono text-[13px] text-ink-1 outline-none"
        />
        {trailing}
      </div>
    </div>
  )
}

export function LoginPage() {
  const { login, error } = useAuth()
  const [emailOrUsername, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    await login(emailOrUsername, password)
    setBusy(false)
  }

  return (
    <div className="grid h-full md:grid-cols-[minmax(320px,1fr)_minmax(380px,440px)]">
      <div className="hidden md:block">
        <SystemLog />
      </div>

      <div className="grid place-items-center px-6 py-10">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <img
            src={logo}
            alt="Ban Công Nghệ"
            className="logo-bcn mb-5 h-10 w-10"
          />
          <h1 className="font-display text-[26px] text-ink-1">Đăng nhập</h1>
          <p className="mt-1 mb-7 text-[13px] text-ink-5">Chào lại, coder.</p>

          <PromptInput
            id="email"
            label="Email hoặc username"
            value={emailOrUsername}
            onChange={setEmail}
            autoComplete="username"
          />
          <PromptInput
            id="password"
            label="Mật khẩu"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="shrink-0 px-2.5 font-mono text-[11px] text-ink-5 hover:text-ink-2"
              >
                {showPassword ? 'ẩn' : 'hiện'}
              </button>
            }
          />

          {error ? (
            <p role="alert" className="mb-4 border-l-2 border-clay bg-[var(--tint-clay)] px-3 py-2 text-[13px] text-ink-3">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" size="lg" disabled={busy} className="w-full">
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>

          <p className="mt-6 text-[12px] leading-[1.65] text-ink-5">
            Chưa có tài khoản? Liên hệ ngay các mentor để được cấp tài khoản.
          </p>
        </form>
      </div>
    </div>
  )
}
