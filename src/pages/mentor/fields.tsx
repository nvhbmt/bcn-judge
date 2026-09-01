/**
 * Ô nhập dùng chung của màn soạn bài — cùng khuôn với `src/components/ui/index.tsx`
 * (tự viết, không kéo thư viện form).
 *
 * Mọi ô đều BẮT BUỘC có `id` để `<label htmlFor>` gắn thật (NFR-6): trình đọc màn
 * hình đọc nhãn khi con trỏ vào ô, và bấm vào nhãn thì focus nhảy đúng ô — thứ mà
 * bọc `<label><input/></label>` cho có thì được, nhưng gợi ý dưới ô lại không đọc.
 * `aria-describedby` nối gợi ý vào ô là lý do `Field` phải tự sinh id gợi ý.
 */
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const CONTROL =
  'w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)] ' +
  'dark:border-slate-600 dark:bg-slate-800'

export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
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

/** Băng lỗi/cảnh báo. `alert` cho lỗi (đọc ngay), `status` cho tin lành (đọc lịch sự). */
export function Notice({
  tone,
  children,
}: {
  tone: 'error' | 'warn' | 'ok' | 'info'
  children: ReactNode
}) {
  const style = {
    error: 'bg-red-50 text-[var(--color-wa)] dark:bg-red-950/40 dark:text-red-300',
    warn: 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
    ok: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    info: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  }[tone]
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md px-3 py-2 text-sm ${style}`}>
      {children}
    </p>
  )
}

export function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-5 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      {hint ? <p className="mb-3 text-xs text-slate-500">{hint}</p> : <div className="mb-2" />}
      {children}
    </section>
  )
}
