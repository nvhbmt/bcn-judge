/** Bộ UI tối giản tự viết (mẫu imath src/components/ui — không kéo thư viện). */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { VERDICT_LABEL, VERDICT_TONE, type Verdict } from '@/types/api'

type ButtonVariant = 'primary' | 'ghost' | 'danger'

const BUTTON_STYLE: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--color-primary)] text-white hover:opacity-90',
  ghost: 'border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800',
  danger: 'bg-[var(--color-wa)] text-white hover:opacity-90',
}

export function Button({
  variant = 'ghost',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium
        transition disabled:cursor-not-allowed disabled:opacity-50
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]
        ${BUTTON_STYLE[variant]} ${className}`}
    />
  )
}

const TONE_CLASS = {
  ac: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  wa: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  tle: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  neutral: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
}

export function VerdictBadge({ verdict, pending }: { verdict: Verdict | null; pending?: boolean }) {
  if (!verdict) {
    return (
      <span className={`rounded px-1.5 py-0.5 font-mono text-xs ${TONE_CLASS.neutral}`}>
        {pending ? 'Đang chấm…' : '—'}
      </span>
    )
  }
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${TONE_CLASS[VERDICT_TONE[verdict]]}`}
      title={VERDICT_LABEL[verdict]}
    >
      {verdict}
    </span>
  )
}

export function Spinner({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-500" role="status">
      <span className="size-3 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--color-primary)]" />
      {label}
    </span>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-slate-500">
      <p className="font-medium text-slate-600 dark:text-slate-300">{title}</p>
      {hint ? <p className="mt-1">{hint}</p> : null}
    </div>
  )
}
