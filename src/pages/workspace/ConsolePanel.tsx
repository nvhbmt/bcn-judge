import { VerdictBadge } from '@/components/ui'
import type { ResultView, SubmissionView } from '@/types/api'

/**
 * Bảng điều khiển dưới editor (FR-E5): tab Chạy thử và tab Kết quả.
 * "Lần nộp đang xem" do trang cha quyết định (FR-E5 v0.5).
 */
export function ConsolePanel({
  tab,
  onTab,
  customInput,
  onCustomInput,
  runResult,
  submission,
}: {
  tab: 'chay-thu' | 'ket-qua'
  onTab: (t: 'chay-thu' | 'ket-qua') => void
  customInput: string
  onCustomInput: (v: string) => void
  runResult: SubmissionView | null
  submission: SubmissionView | null
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" className="flex shrink-0 gap-1 border-b border-line px-2 pt-1">
        <Tab id="chay-thu" active={tab} onTab={onTab}>
          Chạy thử
        </Tab>
        <Tab id="ket-qua" active={tab} onTab={onTab}>
          Kết quả
        </Tab>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
        {tab === 'chay-thu' ? (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-ink-5" htmlFor="custom-input">
              Input tự nhập (bỏ trống để chạy với testcase mẫu)
            </label>
            <textarea
              id="custom-input"
              value={customInput}
              onChange={(e) => onCustomInput(e.target.value)}
              rows={3}
              className="w-full border border-line-strong px-2 py-1 font-mono text-xs"
            />
            <ResultTable submission={runResult} emptyText="Chưa chạy thử lần nào." />
          </div>
        ) : (
          <ResultTable submission={submission} emptyText="Chưa có bài nộp nào." />
        )}
      </div>
    </div>
  )
}

function Tab({
  id,
  active,
  onTab,
  children,
}: {
  id: 'chay-thu' | 'ket-qua'
  active: string
  onTab: (t: 'chay-thu' | 'ket-qua') => void
  children: string
}) {
  return (
    <button
      role="tab"
      aria-selected={active === id}
      onClick={() => onTab(id)}
      className={`px-3 py-1 text-xs font-medium ${
        active === id
          ? 'bg-surface-1 text-ink-1 shadow-[inset_0_-2px_0_var(--color-primary)]'
          : 'text-ink-5'
      }`}
    >
      {children}
    </button>
  )
}

function ResultTable({ submission, emptyText }: { submission: SubmissionView | null; emptyText: string }) {
  if (!submission) return <p className="py-4 text-center text-xs text-ink-5">{emptyText}</p>

  if (submission.compileOutput) {
    return (
      <div>
        <p className="mb-1 text-xs font-medium text-[var(--color-wa)]">Lỗi biên dịch</p>
        <pre className="max-h-60 overflow-auto border border-line bg-[var(--surface-code)] p-2 font-mono text-xs whitespace-pre-wrap text-ink-2">
          {submission.compileOutput}
        </pre>
      </div>
    )
  }

  const results = submission.results ?? []
  if (results.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-ink-5">
        {submission.status === 'done' ? 'Không có kết quả.' : 'Đang chấm…'}
      </p>
    )
  }

  return (
    <table className="w-full text-xs">
      <thead className="text-left text-ink-5">
        <tr>
          <th className="py-1">Test</th>
          <th>Verdict</th>
          <th className="text-right">Thời gian</th>
          <th className="text-right">Bộ nhớ</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {results.map((r) => (
          <ResultRow key={r.position} result={r} />
        ))}
      </tbody>
    </table>
  )
}

function ResultRow({ result }: { result: ResultView }) {
  return (
    <>
      <tr className="border-t border-line">
        <td className="py-1">
          #{result.position} {result.isSample ? <span className="text-ink-6">mẫu</span> : <span className="text-ink-6">ẩn</span>}
        </td>
        <td>
          <VerdictBadge verdict={result.verdict} />
          {result.detail ? <span className="ml-1 text-ink-6">{result.detail}</span> : null}
        </td>
        <td className="text-right tabular-nums">{result.timeMs ?? '—'} ms</td>
        <td className="text-right tabular-nums">
          {result.memoryKb ? `${Math.round(result.memoryKb / 1024)} MB` : '—'}
        </td>
      </tr>
      {/* Diff chỉ có ở testcase MẪU — test ẩn không bao giờ trả stdout (NFR-2). */}
      {result.isSample && result.verdict === 'WA' && result.stdout !== undefined ? (
        <tr>
          <td colSpan={4} className="pb-2">
            <pre className="overflow-x-auto bg-surface-1 p-2 whitespace-pre-wrap">
              Output của bạn: {result.stdout || '(rỗng)'}
              {result.firstDiffLine ? `\nKhác từ dòng ${result.firstDiffLine}` : ''}
            </pre>
          </td>
        </tr>
      ) : null}
    </>
  )
}
