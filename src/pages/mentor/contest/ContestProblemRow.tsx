/**
 * MỘT dòng bài trong contest: nhãn, tiêu đề, điểm tối đa, đổi vị trí, gỡ, và lối sang
 * trình soạn bài — tất cả trên cùng một hàng.
 *
 * Trước đây danh sách chỉ để chọn, còn các ô sửa nằm ở khối riêng bên dưới. Với contest
 * 10 bài thì mọi thao tác đều thành hai nhịp (bấm chọn → kéo mắt xuống), và đổi thứ tự
 * — việc hay làm nhất — mất luôn ngữ cảnh vì hàng đang sửa nằm ngoài tầm nhìn.
 *
 * Chỉ sửa thứ `contest_problems` giữ. Đề bài, testcase, lời giải mẫu thuộc về bản thân
 * bài tập và nằm ở trình soạn bài — nên chỗ này chỉ dẫn sang đó, không nhân bản form.
 */
import { ArrowDown, ArrowUp, SquarePen, Trash2 } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router-dom'
// `max-w-*` chứ không phải `w-*` cho hai ô dưới: CONTROL của TextInput đã có `w-full`,
// và hai lớp width cùng độ đặc hiệu thì thắng thua do thứ tự trong file CSS sinh ra,
// không do thứ tự viết trong className — nên `w-12` thua im lặng và ô giãn hết hàng.
import { TextInput } from '@/pages/mentor/fields'
import type { ContestProblemDraft } from '@/pages/mentor/mentorTypes'

/** Nút biểu tượng của hàng: vuông, không nhãn chữ, nên phải có `title` + `aria-label`. */
function RowButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-7 shrink-0 place-items-center text-ink-5 transition-colors duration-120 ease-linear
                 hover:bg-surface-sel hover:text-ink-2 disabled:cursor-not-allowed disabled:text-line-strong
                 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-1
                 focus-visible:outline-moss"
    >
      {children}
    </button>
  )
}

export function ContestProblemRow({
  draft,
  index,
  total,
  locked,
  onPatch,
  onMove,
  onRemove,
}: {
  draft: ContestProblemDraft
  index: number
  total: number
  /** Đã có người nộp — server từ chối gỡ, nên nút gỡ tắt hẳn chứ không để bấm rồi lỗi. */
  locked: boolean
  onPatch: (part: Partial<ContestProblemDraft>) => void
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
}) {
  const labelId = useId()
  const scoreId = useId()

  return (
    <li className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 last:border-b-0 hover:bg-surface-sel">
      <label htmlFor={labelId} className="sr-only">
        Nhãn của bài {draft.title}
      </label>
      <TextInput
        id={labelId}
        value={draft.label}
        maxLength={4}
        placeholder={String(index + 1)}
        onChange={(e) => onPatch({ label: e.currentTarget.value })}
        className="max-w-12 shrink-0 text-center font-mono"
      />

      <span className="min-w-0 flex-1 truncate text-sm" title={draft.title}>
        {draft.title}
      </span>

      <label htmlFor={scoreId} className="sr-only">
        Điểm tối đa của bài {draft.title}
      </label>
      <div className="flex shrink-0 items-center gap-1">
        <TextInput
          id={scoreId}
          inputMode="numeric"
          value={draft.maxScore}
          onChange={(e) => onPatch({ maxScore: e.currentTarget.value })}
          className="max-w-16 text-right font-mono tabular-nums"
        />
        <span className="font-mono text-xs text-ink-6">đ</span>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <RowButton label="Đưa lên trên" onClick={() => onMove(-1)} disabled={index === 0}>
          <ArrowUp size={15} />
        </RowButton>
        <RowButton label="Đưa xuống dưới" onClick={() => onMove(1)} disabled={index === total - 1}>
          <ArrowDown size={15} />
        </RowButton>
        <Link
          to={`/mentor/bai-tap/${draft.problemId}`}
          title="Sửa nội dung bài (đề, testcase)"
          aria-label={`Sửa nội dung bài ${draft.title}`}
          className="grid size-7 shrink-0 place-items-center text-ink-5 transition-colors duration-120
                     ease-linear hover:bg-surface-sel hover:text-ink-2 focus-visible:outline-2
                     focus-visible:outline-offset-1 focus-visible:outline-moss"
        >
          <SquarePen size={15} />
        </Link>
        <RowButton
          label={locked ? 'Bài đã có người nộp — không gỡ được' : 'Gỡ khỏi contest'}
          onClick={onRemove}
          disabled={locked}
        >
          <Trash2 size={15} />
        </RowButton>
      </div>
    </li>
  )
}
