/**
 * Khung phải: đề bài dựng sống bằng đúng `<Markdown>` mà member dùng.
 *
 * Cố tình KHÔNG viết bộ dựng riêng cho mentor: nếu khung xem trước dùng một đường
 * render khác với trang làm bài thì nó ngừng là bằng chứng — mentor xem thấy đẹp
 * mà member vẫn có thể gặp công thức vỡ. Dùng chung component thì mọi thứ hiện ở
 * đây (KaTeX, code block, lọc sanitize) là thứ member thấy y hệt.
 */
import { Markdown } from '@/components/markdown/Markdown'
import { previewSource, type ProblemFormValues } from './form'

export function StatementPreview({
  values,
  sampleCount,
  hiddenCount,
}: {
  values: ProblemFormValues
  sampleCount: number
  hiddenCount: number
}) {
  return (
    <div className="h-full overflow-auto bg-surface-1 px-5 py-4">
      <p className="mb-3 text-xs font-semibold tracking-wide text-ink-6 uppercase">Member sẽ đọc thế này</p>

      <div className="mb-4 flex flex-wrap gap-3 bg-surface-2 px-3 py-2 font-mono text-xs text-ink-5">
        <span>{values.timeLimitMs || '—'} ms</span>
        <span>{values.memoryLimitMb || '—'} MB</span>
        <span>{sampleCount} testcase mẫu</span>
        <span>{hiddenCount} testcase ẩn</span>
      </div>

      <Markdown source={previewSource(values)} />
    </div>
  )
}
