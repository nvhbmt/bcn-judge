/**
 * Ô soạn dùng chung cho: mở chủ đề (có tiêu đề), trả lời, và sửa (nạp sẵn nội dung cũ).
 *
 * Nội dung là Markdown + LaTeX — cùng cú pháp với đề bài, để người học đã quen. Có hai
 * nút chèn nhanh KHỐI CODE (vì dán code để hỏi "sao WA?" là việc thường xuyên nhất ở
 * đây): một khối rỗng, và "chèn code đang viết" lấy thẳng mã trong editor — cả hai
 * đóng đúng fence ```<ngôn ngữ> để tô màu. Không có thanh định dạng nào khác: hệ thiết
 * kế tối giản, Markdown gõ tay là đủ.
 */
import { Code2, FileCode2 } from 'lucide-react'
import { useContext, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { DiscussionEditorContext } from './editorContext'

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
  const { codeLang, currentCode } = useContext(DiscussionEditorContext)
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const canSend = body.trim().length > 0 && (!withTitle || title.trim().length > 0) && !pending

  /** Chèn `text` tại con trỏ (tự thêm dòng trống bao quanh nếu cần); caret về `caretInto`. */
  function insert(text: string, caretInto?: number): void {
    const ta = taRef.current
    const start = ta ? ta.selectionStart : body.length
    const end = ta ? ta.selectionEnd : body.length
    const before = body.slice(0, start)
    const after = body.slice(end)
    const nlBefore = before.length > 0 && !before.endsWith('\n') ? '\n' : ''
    const nlAfter = after.length > 0 && !after.startsWith('\n') ? '\n' : ''
    setBody(before + nlBefore + text + nlAfter + after)
    const caret = before.length + nlBefore.length + (caretInto ?? text.length)
    requestAnimationFrame(() => {
      ta?.focus()
      ta?.setSelectionRange(caret, caret)
    })
  }

  const fenceOpen = '```' + codeLang + '\n'
  const insertEmptyBlock = () => insert(fenceOpen + '\n```', fenceOpen.length)
  const insertCurrentCode = () => insert(fenceOpen + currentCode.replace(/\n+$/, '') + '\n```')

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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={insertEmptyBlock}
          className="flex items-center gap-1 border border-line-strong px-2 py-1 font-mono text-[11px] text-ink-4 hover:border-ink-5 hover:text-ink-1"
        >
          <Code2 size={13} /> Khối code
        </button>
        {currentCode.trim() ? (
          <button
            type="button"
            onClick={insertCurrentCode}
            className="flex items-center gap-1 border border-line-strong px-2 py-1 font-mono text-[11px] text-ink-4 hover:border-ink-5 hover:text-ink-1"
          >
            <FileCode2 size={13} /> Chèn code đang viết
          </button>
        ) : null}
      </div>

      <textarea
        ref={taRef}
        value={body}
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
