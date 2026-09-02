/**
 * Khung phải: đề bài dựng sống bằng ĐÚNG component mà member đọc.
 *
 * Không chỉ dùng chung `<Markdown>` mà dùng thẳng `<StatementPanel>` — cùng bố cục,
 * cùng dải số liệu, cùng khối ví dụ, cùng câu nhắc luật so khớp. Khung xem trước mà
 * tự vẽ lấy một kiểu khác thì nó thôi là bằng chứng: mentor nhìn thấy một đằng,
 * member đọc một nẻo, và cái lệch đó không ai phát hiện cho tới lúc có người hỏi.
 *
 * Giá phải trả: mọi trường `ProblemView` mà form chưa có (tags, starterCode…) phải
 * dựng tạm ở đây. Đổi lại, thêm một mục vào đề bài là khung này tự có, không phải
 * nhớ sửa hai chỗ.
 */
import { StatementPanel } from '@/pages/workspace/StatementPanel'
import type { ProblemView, SampleIO } from '@/types/api'
import type { ProblemFormValues } from './form'
import type { MentorTestcaseView } from './types'

export function StatementPreview({
  values,
  testcases,
}: {
  values: ProblemFormValues
  /** Testcase ĐÃ LƯU — khung này cho thấy thứ member đọc, không phải bảng đang gõ dở. */
  testcases: MentorTestcaseView[]
}) {
  const samples: SampleIO[] = testcases
    .filter((t) => t.kind === 'sample')
    .map((t) => ({ position: t.position, input: t.inputPreview, expected: t.expectedPreview }))

  const problem: ProblemView = {
    id: 'preview',
    title: values.title.trim() || 'Bài chưa đặt tên',
    kind: values.kind,
    statementMd: values.statementMd,
    inputDescMd: values.inputDescMd.trim() || null,
    outputDescMd: values.outputDescMd.trim() || null,
    constraintsMd: values.constraintsMd.trim() || null,
    examples: [],
    timeLimitMs: Number.parseInt(values.timeLimitMs, 10) || 0,
    memoryLimitMb: Number.parseInt(values.memoryLimitMb, 10) || 0,
    difficulty: values.difficulty || null,
    // Form soạn bài chưa có ô tag; để rỗng thì StatementPanel bỏ luôn hàng đó.
    tags: [],
    compareMode: values.compareMode,
    allowedLanguageIds: null,
    starterCode: {},
    samples,
    hiddenTestcaseCount: testcases.filter((t) => t.kind !== 'sample').length,
  }

  return (
    <div className="h-full overflow-auto bg-surface-1">
      <p className="px-5 pt-4 text-xs font-semibold tracking-wide text-ink-6 uppercase">Xem trước</p>
      <StatementPanel problem={problem} headingLevel={2} />
    </div>
  )
}
