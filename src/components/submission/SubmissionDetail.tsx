/**
 * Panel phải: chi tiết MỘT lượt nộp — CHỈ ĐỌC.
 *
 * Dùng chung cho leader xem đồng đội (FR-J3/J4) và mentor xem học viên (FR-G3). Hai
 * bên nhận dữ liệu từ hai endpoint khác nhau, nhưng thứ HIỆN RA thì giống hệt, nên
 * `CodeView` chỉ nêu đúng những trường được vẽ — không buộc phía gọi phải có nguyên
 * hình dạng của bên kia.
 *
 * Contest còn đang chạy thì source bị khoá tới giờ đóng: leader cũng là thí sinh, nên
 * cho họ đọc code của đồng đội giữa contest là mở một đường gian lận.
 *
 * Lời báo là CHỮ, không có icon ổ khoá. (Chú thích cũ ở đây ghi 🔒 là "pictograph duy
 * nhất hệ thiết kế cho phép" — design-system/readme.md không hề có luật đó.)
 *
 * MÁY CHỦ mới là chỗ quyết định: nó trả `source: null`. Ở đây chỉ trình bày — không
 * có nhánh nào ở client tự quyết được xem hay không.
 */
import { useMemo } from 'react'
import { highlightCode } from '@/components/markdown/render'
import { EmptyState, VerdictBadge } from '@/components/ui'
import type { LanguageOption, Verdict } from '@/types/api'

export interface CodeView {
  problemTitle: string | null
  verdict: Verdict | null
  score: number | null
  languageId: string
  receivedAt: string
  source: string | null
  /** Chỉ leader mới có khái niệm này (source bị hoãn tới hết contest). */
  sourceEmbargoedUntil?: string | null
}

export function SubmissionDetail({
  submission,
  languages,
}: {
  submission: CodeView | null
  /** Để tra `cmMode` — chính bảng `languages` nói ngôn ngữ nào tô kiểu gì, không
   *  phải một bảng ánh xạ chép tay ở client sẽ lệch khi admin thêm ngôn ngữ. */
  languages: LanguageOption[]
}) {
  const mode = languages.find((l) => l.id === submission?.languageId)?.cmMode ?? null
  const html = useMemo(
    () => (submission?.source ? highlightCode(submission.source, mode) : null),
    [submission?.source, mode],
  )

  if (!submission) {
    return (
      <div className="grid h-full place-items-center px-6">
        <EmptyState title="Chọn một lượt nộp" hint="Danh sách bài nộp nằm ở panel bên trái." />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-line px-4 py-2.5">
        <p className="truncate text-[14px] font-semibold text-ink-1">
          {submission.problemTitle ?? <span className="font-normal text-ink-6">(bài đã xoá)</span>}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <VerdictBadge tone="soft" verdict={submission.verdict} />
          <span className="num font-mono text-[13px] text-ink-3">{submission.score ?? '—'} đ</span>
          <span className="bg-surface-sel px-1.5 py-0.5 font-mono text-[11px] text-ink-4">
            {languages.find((l) => l.id === submission.languageId)?.name ?? submission.languageId}
          </span>
          <span className="num ml-auto font-mono text-[12px] text-ink-6">
            {new Date(submission.receivedAt).toLocaleString('vi-VN')}
          </span>
        </div>
      </div>

      {html !== null ? (
        /* `--surface-editor`, KHÔNG phải `--surface-3`: bản vẽ cho mọi vùng mã nguồn
           cùng một mặt phẳng, và ở nền sáng nó là mặt sáng NHẤT.
           `markdown-body` để dùng lại đúng bảng màu hljs của khối code trong đề —
           một bộ màu cho mọi chỗ hiện mã, không phải hai. */
        <div
          className="markdown-body min-h-0 flex-1 overflow-auto bg-surface-editor px-4 py-3 text-[13px]"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center px-6">
          <p className="max-w-sm text-center font-mono text-[12px] leading-[1.7] text-ink-5">
            Contest đang diễn ra — xem code sau{' '}
            {submission.sourceEmbargoedUntil
              ? new Date(submission.sourceEmbargoedUntil).toLocaleString('vi-VN')
              : 'khi kết thúc'}
            .
          </p>
        </div>
      )}
    </div>
  )
}
