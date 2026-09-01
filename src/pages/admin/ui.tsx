/**
 * Mảnh UI dùng lại trong cụm trang quản trị. Giữ riêng khỏi `@/components/ui`
 * vì đây là thứ chỉ admin cần (ô nhập có nhãn, thẻ mục, băng lỗi có bước tiếp
 * theo) — bộ chung không nên phình vì một cụm trang.
 */
import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import type { FailureNotice } from './conflicts'

const CONTROL =
  'w-full  border border-line-strong bg-surface-2 px-2.5 py-1.5 text-sm ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)] ' +
  'disabled:cursor-not-allowed disabled:opacity-60'

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-3">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-5">{hint}</span> : null}
    </label>
  )
}

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${className}`} />
}

export function TextArea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} font-mono ${className}`} />
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL} ${className}`} />
}

export function Card({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-5 border border-line bg-surface-2 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

/** Băng lỗi kèm bước tiếp theo — 409 phải đọc như hướng dẫn, không như bức tường. */
export function FailureBanner({ notice }: { notice: FailureNotice | null }) {
  if (!notice) return null
  return (
    <p role="alert" className="mb-3 bg-[var(--tint-clay)] px-3 py-2 text-sm">
      <span className="font-medium text-[var(--color-wa)]">{notice.message}</span>
      {notice.nextStep ? (
        <span className="mt-1 block text-ink-3">{notice.nextStep}</span>
      ) : null}
    </p>
  )
}

export function SuccessNote({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="status" className="mb-3 bg-surface-sel px-3 py-2 text-sm text-moss">
      {children}
    </p>
  )
}

/**
 * Nút chép. Dùng `navigator.clipboard` khi có, và luôn có đường lùi bằng
 * `document.execCommand` — trang quản trị hay chạy trên HTTP nội bộ, nơi
 * Clipboard API bị chặn vì không phải secure context. Mất nút chép ở đây đồng
 * nghĩa admin phải chép tay mật khẩu sinh ngẫu nhiên.
 */
export function CopyButton({ value, label = 'Chép' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(() => setDone(false), 1500)
    return () => window.clearTimeout(timer)
  }, [done])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      fallbackCopy(value)
    }
    setDone(true)
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex items-center gap-1 border border-line-strong px-2 py-1 text-xs
 hover:bg-surface-sel focus-visible:outline-2 focus-visible:outline-offset-1
 focus-visible:outline-[var(--color-primary)]"
    >
      {done ? <Check size={13} className="text-[var(--color-ac)]" /> : <Copy size={13} />}
      {done ? 'Đã chép' : label}
    </button>
  )
}

function fallbackCopy(value: string) {
  const area = document.createElement('textarea')
  area.value = value
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(area)
  }
}
