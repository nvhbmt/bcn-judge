import { VerdictBadge } from '@/components/ui'
import type { ResultView, SubmissionView } from '@/types/api'

/**
 * Bảng điều khiển dưới editor (FR-E5).
 *
 * BA tab theo bản vẽ, không phải hai: `kết quả` · `chạy thử` · `stdin tự nhập`. Ô nhập
 * stdin trước đây nằm LỒNG trong tab "chạy thử", nên mỗi lần muốn sửa input là phải rời
 * khỏi kết quả vừa xem. Tách ra thành tab riêng đúng như thiết kế: input là dữ liệu bạn
 * soạn, kết quả là thứ bạn đọc, hai việc khác nhau.
 *
 * "Lần nộp đang xem" do trang cha quyết định (FR-E5 v0.5) và hiện ở mép phải dải tab.
 */
export type ConsoleTab = 'ket-qua' | 'chay-thu' | 'stdin'

const TABS: { id: ConsoleTab; label: string }[] = [
  { id: 'ket-qua', label: 'kết quả' },
  { id: 'chay-thu', label: 'chạy thử' },
  { id: 'stdin', label: 'stdin tự nhập' },
]

function hhmmss(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function ConsolePanel({
  tab,
  onTab,
  customInput,
  onCustomInput,
  runResult,
  submission,
}: {
  tab: ConsoleTab
  onTab: (t: ConsoleTab) => void
  customInput: string
  onCustomInput: (v: string) => void
  runResult: SubmissionView | null
  submission: SubmissionView | null
}) {
  const dangXem = tab === 'chay-thu' ? runResult : submission

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-1">
      <div role="tablist" className="flex shrink-0 items-center border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onTab(t.id)}
            className={`border-b-2 px-3.5 py-2.5 font-mono text-[11px] transition-colors duration-[120ms] ease-linear ${
              tab === t.id ? 'border-moss text-ink-1' : 'border-transparent text-ink-5 hover:text-ink-2'
            }`}
          >
            {t.label}
          </button>
        ))}

        {/* Mép phải: đang xem lần nộp nào. Bản vẽ đặt nó ở đây thay vì trong thân panel
            để dòng đầu tiên của kết quả không bị đẩy xuống. */}
        {dangXem ? (
          <span className="num ml-auto px-3.5 font-mono text-[11px] text-ink-6">
            {tab === 'chay-thu' ? 'lượt chạy thử' : 'lần nộp'} · {hhmmss(dangXem.receivedAt)}
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3.5 py-3">
        {tab === 'stdin' ? (
          <div className="flex h-full flex-col gap-2">
            <label className="font-mono text-[11px] text-ink-5" htmlFor="custom-input">
              Bỏ trống thì chạy với testcase mẫu.
            </label>
            <textarea
              id="custom-input"
              value={customInput}
              onChange={(e) => onCustomInput(e.target.value)}
              className="min-h-0 flex-1 resize-none border border-line-strong bg-surface-editor px-2.5 py-2 font-mono text-[12px] text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-moss"
            />
          </div>
        ) : tab === 'chay-thu' ? (
          <ResultTable submission={runResult} emptyText="Chưa chạy thử lần nào." />
        ) : (
          <ResultTable submission={submission} emptyText="Chưa có bài nộp nào." />
        )}
      </div>
    </div>
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
