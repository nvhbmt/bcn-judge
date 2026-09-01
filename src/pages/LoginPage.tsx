import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui'
import { useAuth } from '@/stores/auth'

export function LoginPage() {
  const { login, error } = useAuth()
  const [emailOrUsername, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    await login(emailOrUsername, password)
    setBusy(false)
  }

  return (
    <div className="grid h-full place-items-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <h1 className="text-lg font-semibold">BCN Judge</h1>
        <p className="mt-1 mb-5 text-sm text-slate-500">Đăng nhập bằng tài khoản câu lạc bộ cấp.</p>

        <label className="block text-sm font-medium" htmlFor="email">
          Email hoặc tên đăng nhập
        </label>
        <input
          id="email"
          value={emailOrUsername}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          className="mt-1 mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />

        <label className="block text-sm font-medium" htmlFor="password">
          Mật khẩu
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />

        {error ? (
          <p role="alert" className="mt-3 text-sm text-[var(--color-wa)]">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" disabled={busy} className="mt-5 w-full justify-center">
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
      </form>
    </div>
  )
}
