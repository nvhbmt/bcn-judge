/**
 * Dải tab của khung trái trình soạn bài — mỗi NHỊP SỬA một tab, thay cho một cuộn
 * dài nhét đủ thứ dưới nhãn "Đề bài":
 *
 *   Đề bài        nội dung — sửa liên tục, khung phải dựng sống theo
 *   Chấm          giới hạn, dạng bài, cách so, ngôn ngữ — đặt một lần
 *   Code khởi tạo thứ member thấy sẵn trong editor
 *   Harness       CHỈ hiện với bài dạng function
 *   Lời giải      dán một lần, đụng lại khi kiểm hỏng
 *   Testcase      bảng test + nút kiểm
 *
 * Hai kỷ luật giữ nguyên từ bản hai-tab:
 *   1. MỌI panel luôn mount, ẩn bằng `hidden` + `inert` — đổi tab mà unmount thì
 *      bảng testcase đang gõ dở và lịch sử undo của các ô CodeMirror biến mất,
 *      im lặng, đúng lúc mentor đang soạn dở.
 *   2. Tab Harness biến mất khi đổi dạng bài về stdio; đang đứng trên nó thì bị
 *      đưa về tab Chấm — nơi vừa gây ra chuyện đó — chứ không rơi vào panel ẩn.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { ProblemFormValues } from '@/pages/mentor/form'
import type { MentorProblemDetail } from '@/pages/mentor/types'
import { GradingForm } from './GradingForm'
import { HarnessSection } from './HarnessSection'
import { ProblemForm } from './ProblemForm'
import { SolutionSection } from './SolutionSection'
import { StarterCodeSection } from './StarterCodeSection'
import { TestcasePanel } from './TestcasePanel'

export type EditorTabId = 'de-bai' | 'cham' | 'code' | 'harness' | 'loi-giai' | 'testcase'

export function EditorTabs({
  tab,
  onTab,
  values,
  onChange,
  detail,
  hasSolution,
  dirty,
  validated,
  onReloaded,
}: {
  tab: EditorTabId
  onTab: (t: EditorTabId) => void
  values: ProblemFormValues
  onChange: (patch: Partial<ProblemFormValues>) => void
  detail: MentorProblemDetail
  hasSolution: boolean
  dirty: boolean
  validated: boolean
  onReloaded: () => void
}) {
  const isFn = values.kind === 'function'
  // Tab Harness có thể vừa biến mất dưới chân người đứng — xem kỷ luật 2 ở trên.
  const active: EditorTabId = tab === 'harness' && !isFn ? 'cham' : tab

  const TABS: { id: EditorTabId; label: string }[] = [
    { id: 'de-bai', label: 'Đề bài' },
    { id: 'cham', label: 'Chấm' },
    { id: 'code', label: 'Code khởi tạo' },
    ...(isFn ? [{ id: 'harness' as const, label: 'Harness' }] : []),
    { id: 'loi-giai', label: 'Lời giải' },
    { id: 'testcase', label: `Testcase (${detail.testcases.length})` },
  ]

  const panel = (id: EditorTabId, children: ReactNode) => (
    <div id={`panel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`} hidden={active !== id} inert={active !== id}>
      {children}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" className="flex shrink-0 flex-wrap gap-1 border-b border-line px-2 pt-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => onTab(t.id)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium whitespace-nowrap',
              active === t.id ? 'bg-surface-1 shadow-[inset_0_-2px_0_var(--color-primary)]' : 'text-ink-5',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {panel('de-bai', <ProblemForm values={values} onChange={onChange} />)}
        {panel('cham', <GradingForm values={values} onChange={onChange} />)}
        {panel(
          'code',
          <div className="px-4 py-4">
            <StarterCodeSection values={values} onChange={onChange} />
          </div>,
        )}
        {/* Panel harness mount theo dạng bài (component tự đòi kind=function);
            tab của nó cũng chỉ hiện lúc đó nên không có đường bấm vào panel rỗng. */}
        {panel('harness', isFn ? <div className="px-4 py-4"><HarnessSection values={values} onChange={onChange} /></div> : null)}
        {panel(
          'loi-giai',
          <div className="px-4 py-4">
            <SolutionSection values={values} onChange={onChange} />
          </div>,
        )}
        {panel(
          'testcase',
          <TestcasePanel
            problemId={detail.id}
            testcaseRev={detail.testcaseRev}
            testcases={detail.testcases}
            compareMode={values.compareMode}
            hasSolution={hasSolution}
            dirty={dirty}
            validated={validated}
            onReloaded={onReloaded}
          />,
        )}
      </div>
    </div>
  )
}
