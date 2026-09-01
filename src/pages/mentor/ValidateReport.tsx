/**
 * Báo cáo của một lượt kiểm (FR-D6) — trả lời đúng một câu: *bộ test này có dùng được không*.
 *
 * Thứ tự đặt trên màn hình là thứ tự người soạn cần biết, không phải thứ tự dữ liệu:
 * kết luận trước, rồi testcase HỎNG, rồi mới tới bảng đầy đủ. Mentor mở nó ra vì
 * nghi bộ test sai, nên "testcase 7 WA" phải đập vào mắt chứ không nằm lẫn giữa
 * chín dòng AC.
 *
 * Giới hạn có thật, nói thẳng ra trong UI: lượt kiểm đọc qua
 * `GET /api/member/submissions/:id`, mà serializer member chỉ trả stdout/diff cho
 * testcase MẪU (NFR-2). Testcase ẩn sai thì chỉ có verdict, không có diff.
 */
import { VerdictBadge } from '@/components/ui'
import type { ResultView, SubmissionView } from '@/types/api'
import { Notice } from './fields'

export function ValidateReport({ submission }: { submission: SubmissionView }) {
  if (submission.compileOutput) {
    return (
      <div className="space-y-2">
        <Notice tone="error">Lời giải mẫu không biên dịch được — chưa kiểm được testcase nào.</Notice>
        <pre className="max-h-40 overflow-auto border border-line bg-[var(--surface-code)] p-2 font-mono text-xs whitespace-pre-wrap text-ink-2">
          {submission.compileOutput}
        </pre>
      </div>
    )
  }

  const results = submission.results ?? []
  if (results.length === 0) {
    return <Notice tone="warn">Lượt kiểm chạy xong nhưng không có kết quả testcase nào.</Notice>
  }

  const failed = results.filter((r) => r.verdict !== 'AC')
  if (failed.length === 0) {
    return (
      <Notice tone="ok">
        <strong>{results.length}/{results.length} testcase khớp lời giải mẫu.</strong> Bộ test dùng được — bài
        chuyển sang trạng thái “đã kiểm”.
      </Notice>
    )
  }

  return (
    <div className="space-y-2">
      <Notice tone="error">
        <strong>
          {failed.length}/{results.length} testcase KHÔNG khớp lời giải mẫu:{' '}
          {failed.map((r) => `#${r.position} ${r.verdict}`).join(', ')}.
        </strong>{' '}
        Sửa expected output của những testcase đó, hoặc sửa lời giải mẫu, rồi kiểm lại.
      </Notice>
      <ul className="space-y-2">
        {failed.map((r) => (
          <FailedRow key={r.position} result={r} />
        ))}
      </ul>
      <details className="text-xs text-ink-5">
        <summary className="cursor-pointer">Xem toàn bộ {results.length} testcase</summary>
        <ul className="mt-1 flex flex-wrap gap-1">
          {results.map((r) => (
            <li key={r.position} className="flex items-center gap-1 bg-surface-1 px-1.5 py-0.5">
              <span className="font-mono">#{r.position}</span>
              <VerdictBadge verdict={r.verdict} />
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function FailedRow({ result }: { result: ResultView }) {
  return (
    <li className="border border-clay px-2 py-1.5 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-mono font-semibold">Testcase #{result.position}</span>
        <VerdictBadge verdict={result.verdict} />
        <span className="text-ink-5">{result.isSample ? 'mẫu' : 'ẩn'}</span>
        <span className="ml-auto font-mono text-ink-6 tabular-nums">
          {result.timeMs ?? '—'} ms
          {result.memoryKb ? ` · ${Math.round(result.memoryKb / 1024)} MB` : ''}
        </span>
      </div>
      {result.detail ? <p className="mt-1 font-mono text-ink-5">{result.detail}</p> : null}
      {result.isSample && result.stdout !== undefined && result.stdout !== null ? (
        <pre className="mt-1 max-h-32 overflow-auto bg-surface-1 p-2 font-mono whitespace-pre-wrap">
          Lời giải mẫu in ra: {result.stdout || '(rỗng)'}
          {result.firstDiffLine ? `\nKhác expected từ dòng ${result.firstDiffLine}` : ''}
        </pre>
      ) : (
        <p className="mt-1 text-ink-5">
          {result.isSample
            ? 'Không có output để đối chiếu.'
            : 'Testcase ẩn: API chỉ trả verdict, không trả diff — mở nó thành testcase mẫu nếu cần xem output.'}
        </p>
      )}
    </li>
  )
}
