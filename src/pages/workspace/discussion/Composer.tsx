/**
 * Ô soạn dùng chung cho: mở chủ đề (có tiêu đề), trả lời, và sửa (nạp sẵn nội dung cũ).
 *
 * Nội dung là Markdown + LaTeX — cùng cú pháp với đề bài, để người học đã quen. Không
 * có thanh nút định dạng: hệ thiết kế tối giản, và Markdown gõ tay là đủ cho hỏi/đáp.
 */
import { useState } from 'react'
import { Button } from '@/components/ui'

export interface ComposerValues {
  title: string
  bodyMd: string
}

export function Composer({
  withTitle = false,
  initialTitle = '',
  initialBody = '',
  submitLabel,
  placeholder,
  pending = false,
  autoFocus = false,
  onSubmit,
  onCancel,
}: {
  withTitle?: boolean
  initialTitle?: string
  initialBody?: string
  submitLabel: string
  placeholder?: string
  pending?: boolean
  autoFocus?: boolean
  onSubmit: (v: ComposerValues) => void
  onCancel?: () => void
}) {
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const canSend = body.trim().length > 0 && (!withTitle || title.trim().length > 0) && !pending

  return (
    <div className="flex flex-col gap-2">
      {withTitle ? (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Tiêu đề — hỏi gì?"
          aria-label="Tiêu đề chủ đề"
          className="border border-line-strong bg-surface-2 px-2.5 py-2 text-[15px] text-ink-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-moss"
        />
      ) : null}
      <textarea
        value={body}
        // eslint chỉ chạy check-source-rules ở repo này; autoFocus có chủ đích cho ô trả lời.
        autoFocus={autoFocus}
        onChange={(e) => setBody(e.target.value)}
        rows={withTitle ? 4 : 3}
        maxLength={5000}
        placeholder={placeholder ?? 'Nội dung… (Markdown & LaTeX)'}
        aria-label="Nội dung"
        className="resize-y border border-line-strong bg-surface-2 px-2.5 py-2 font-mono text-[13px] text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-moss"
      />
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          disabled={!canSend}
          onClick={() => onSubmit({ title: title.trim(), bodyMd: body.trim() })}
        >
          {pending ? 'Đang gửi…' : submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Huỷ
          </Button>
        ) : null}
        <span className="ml-auto font-mono text-[11px] text-ink-6">Markdown &amp; LaTeX</span>
      </div>
    </div>
  )
}
