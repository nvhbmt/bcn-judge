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
  'w-full border border-line-strong bg-surface-2 px-2 py-1.5 text-sm text-ink-2 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-moss'

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
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-ink-3">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-5">
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
    error: 'bg-[var(--tint-clay)] text-[var(--color-wa)]',
    warn: 'bg-[var(--tint-earth)] text-earth',
    ok: 'bg-surface-sel text-moss',
    info: 'bg-surface-1 text-ink-3',
  }[tone]
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={` px-3 py-2 text-sm ${style}`}>
      {children}
    </p>
  )
}

export function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-5 border border-line bg-surface-2 p-3">
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      {hint ? <p className="mb-3 text-xs text-ink-5">{hint}</p> : <div className="mb-2" />}
      {children}
    </section>
  )
}
