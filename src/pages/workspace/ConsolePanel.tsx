import type { SampleIO, SubmissionView } from '@/types/api'
import { ResultTable } from './ResultTable'
import { StdinPane } from './StdinPane'

/**
 * Bảng điều khiển dưới editor (FR-E5).
 *
 * BA tab theo bản vẽ, không phải hai: `kết quả` · `chạy thử` · `stdin tự nhập`. Ô nhập
 * stdin trước đây nằm LỒNG trong tab "chạy thử", nên mỗi lần muốn sửa input là phải rời
 * khỏi kết quả vừa xem.
 *
 * Ba tab là ba câu hỏi khác nhau, nên không tab nào trả lời hộ tab nào:
 *   - kết quả       — lần NỘP gần nhất chấm ra sao
 *   - chạy thử      — chạy testcase MẪU thì đúng được mấy test
 *   - stdin tự nhập — đưa input này vào thì chương trình in ra gì (có nút chạy riêng)
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
  onRunCustom,
  busy,
  sampleRun,
  customRun,
  customRunPending,
  submission,
  samples,
  compareMode,
}: {
  tab: ConsoleTab
  onTab: (t: ConsoleTab) => void
  customInput: string
  onCustomInput: (v: string) => void
  onRunCustom: () => void
  busy: 'run' | 'submit' | null
  /** Lượt chạy testcase mẫu gần nhất — chỉ tab "chạy thử" đọc nó. */
  sampleRun: SubmissionView | null
  /** Lượt chạy với input tự nhập gần nhất — chỉ tab "stdin tự nhập" đọc nó. */
  customRun: SubmissionView | null
  /** Đã bấm chạy nhưng kết quả chưa về — khoảng này `customRun` vẫn còn null. */
  customRunPending: boolean
  submission: SubmissionView | null
  /** Testcase mẫu của bài, để dựng bảng so output khi sai. */
  samples: SampleIO[]
  /** Luật so của bài — bảng diff phải chuẩn hoá giống hệt máy chấm. */
  compareMode: string
}) {
  const dangXem = tab === 'chay-thu' ? sampleRun : tab === 'ket-qua' ? submission : null

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
          <StdinPane
            value={customInput}
            onChange={onCustomInput}
            onRun={onRunCustom}
            busy={busy}
            pending={customRunPending}
            result={customRun}
          />
        ) : tab === 'chay-thu' ? (
          <ResultTable
            submission={sampleRun}
            samples={samples}
            compareMode={compareMode}
            emptyText="Chưa chạy thử lần nào."
          />
        ) : (
          <ResultTable
            submission={submission}
            samples={samples}
            compareMode={compareMode}
            emptyText="Chưa có bài nộp nào."
          />
        )}
      </div>
    </div>
  )
}
