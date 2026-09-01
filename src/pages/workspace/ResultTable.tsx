/**
 * Bảng kết quả chấm dùng chung cho tab "kết quả" và tab "chạy thử".
 *
 * Testcase mẫu sai thì mở thẳng bảng so output (kiểu LeetCode) ngay dưới dòng đó. Test
 * ẩn không bao giờ có stdout để mà so — NFR-2 chặn ở serializer, không phải ở đây.
 */
import { VerdictBadge } from '@/components/ui'
import type { ResultView, SampleIO, SubmissionView } from '@/types/api'
import { OutputDiff } from './OutputDiff'

export function ResultTable({
  submission,
  samples,
  compareMode,
  emptyText,
}: {
  submission: SubmissionView | null
  samples: SampleIO[]
  compareMode: string
  emptyText: string
}) {
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
          <ResultRow
            key={r.position}
            result={r}
            sample={samples.find((s) => s.position === r.position) ?? null}
            compareMode={compareMode}
          />
        ))}
      </tbody>
    </table>
  )
}

function ResultRow({
  result,
  sample,
  compareMode,
}: {
  result: ResultView
  sample: SampleIO | null
  compareMode: string
}) {
  // Diff chỉ có ở testcase MẪU — test ẩn không bao giờ trả stdout (NFR-2).
  const wrong = result.isSample && result.verdict === 'WA' && result.stdout !== undefined && result.stdout !== null

  return (
    <>
      <tr className="border-t border-line">
        <td className="py-1">
          #{result.position}{' '}
          {result.isSample ? <span className="text-ink-6">mẫu</span> : <span className="text-ink-6">ẩn</span>}
        </td>
        <td>
          <VerdictBadge verdict={result.verdict} />
          {result.detail ? <span className="ml-1 text-ink-6">{result.detail}</span> : null}
        </td>
        <td className="text-right tabular-nums">{result.timeMs ?? '—'} ms</td>
        <td className="text-right tabular-nums">{result.memoryKb ? `${Math.round(result.memoryKb / 1024)} MB` : '—'}</td>
      </tr>

      {wrong ? (
        <tr>
          <td colSpan={4} className="pb-2">
            {sample?.expected != null ? (
              <OutputDiff
                position={result.position}
                input={sample.input}
                got={result.stdout ?? ''}
                want={sample.expected}
                compareMode={compareMode}
              />
            ) : (
              // Không ghép được testcase mẫu (bài trong contest có thể không công bố
              // mẫu) thì vẫn đưa output ra, chứ không nuốt mất thông tin duy nhất có.
              <pre className="overflow-x-auto border border-line bg-surface-2 p-2 whitespace-pre-wrap">
                Output của bạn: {result.stdout || '(rỗng)'}
                {result.firstDiffLine ? `\nKhác từ dòng ${result.firstDiffLine}` : ''}
              </pre>
            )}
          </td>
        </tr>
      ) : null}
    </>
  )
}
