/**
 * Báo cáo của một lượt kiểm (FR-D6) — trả lời đúng một câu: *bộ test này có dùng được không*.
 *
 * Thứ tự trên màn hình là thứ tự người soạn cần biết, không phải thứ tự dữ liệu:
 * kết luận trước, rồi từng testcase HỎNG kèm bằng chứng, rồi mới tới dải đầy đủ.
 * Mentor mở nó ra vì nghi bộ test sai, nên "testcase 7 WA" phải đập vào mắt chứ
 * không nằm lẫn giữa chín dòng AC.
 *
 * Bằng chứng là một BẢNG SO thật (`OutputDiff` — đúng component member dùng), không
 * phải một dòng "in ra: …". Hai thứ khiến nó dựng được:
 *   - `mentorStdout` từ route mentor có ở MỌI testcase, kể cả ẩn;
 *   - expected ghép theo `position` từ bảng testcase mà trình soạn đang giữ.
 * Bản trước đọc qua đường member nên test ẩn chỉ có verdict trần, và mentor phải mở
 * test ẩn thành mẫu mới xem được output — đúng thứ US-2 nói là không chấp nhận được.
 */
import { VerdictBadge } from '@/components/ui'
import { OutputDiff } from '@/pages/workspace/OutputDiff'
import { Notice } from './fields'
import type { CompareMode, MentorTestcaseView, ValidateResultView, ValidateRunView } from './types'
import { cn } from '@/lib/cn'

export function ValidateReport({
  result,
  testcases,
  compareMode,
}: {
  result: ValidateRunView
  /** Nguồn của input/expected để dựng bảng so — ghép theo `position`. */
  testcases: MentorTestcaseView[]
  compareMode: CompareMode
}) {
  if (result.compileOutput) {
    return (
      <div className="space-y-2">
        <Notice tone="error">Lời giải mẫu không biên dịch được — chưa kiểm được testcase nào.</Notice>
        <pre className="max-h-40 overflow-auto border border-line bg-surface-code p-2 font-mono text-xs whitespace-pre-wrap text-ink-2">
          {result.compileOutput}
        </pre>
      </div>
    )
  }

  const results = result.results ?? []
  if (results.length === 0) {
    return <Notice tone="warn">Lượt kiểm chạy xong nhưng không có kết quả testcase nào.</Notice>
  }

  const failed = results.filter((r) => r.verdict !== 'AC')
  const byPosition = new Map(testcases.map((t) => [t.position, t]))

  return (
    <div className="space-y-3">
      {failed.length === 0 ? (
        <Notice tone="ok">
          <strong>
            {results.length}/{results.length} testcase khớp lời giải mẫu.
          </strong>{' '}
          Bộ test dùng được — bài chuyển sang trạng thái “đã kiểm”.
        </Notice>
      ) : (
        <Notice tone="error">
          <strong>
            {failed.length}/{results.length} testcase KHÔNG khớp lời giải mẫu.
          </strong>{' '}
          Sửa expected output của những testcase đó, hoặc sửa lời giải mẫu, rồi kiểm lại.
        </Notice>
      )}

      {/* Dải tổng quan luôn hiện: nó là bản đồ của cả lượt kiểm, và với bộ test dài
          thì đây là chỗ duy nhất thấy được "hỏng ở đầu hay rải đều". */}
      <ul className="flex flex-wrap gap-1" aria-label="Kết quả từng testcase">
        {results.map((r) => (
          <li
            key={r.position}
            className={cn(
              'flex items-center gap-1.5 border px-1.5 py-0.5',
              r.verdict === 'AC' ? 'border-line bg-surface-1' : 'border-clay bg-surface-2',
            )}
          >
            <span className="font-mono text-[11px] text-ink-5">#{r.position}</span>
            <VerdictBadge tone="soft" verdict={r.verdict} />
          </li>
        ))}
      </ul>

      {failed.map((r) => (
        <FailedCase key={r.position} result={r} testcase={byPosition.get(r.position)} compareMode={compareMode} />
      ))}
    </div>
  )
}

function FailedCase({
  result,
  testcase,
  compareMode,
}: {
  result: ValidateResultView
  testcase: MentorTestcaseView | undefined
  compareMode: CompareMode
}) {
  const got = result.mentorStdout ?? result.stdout
  const want = testcase?.expectedPreview ?? null

  return (
    <section className="border border-clay">
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-2.5 py-1.5 text-xs">
        <span className="font-mono font-semibold">Testcase #{result.position}</span>
        <VerdictBadge verdict={result.verdict} />
        <span className="text-ink-5">{result.isSample ? 'mẫu' : 'ẩn'}</span>
        <span className="ml-auto font-mono text-ink-6 tabular-nums">
          {result.timeMs ?? '—'} ms
          {result.memoryKb ? ` · ${Math.round(result.memoryKb / 1024)} MB` : ''}
        </span>
      </header>

      <div className="space-y-2 p-2.5">
        {result.detail ? <p className="font-mono text-xs text-ink-5">{result.detail}</p> : null}

        {/* WA là ca DUY NHẤT mà bảng so nói được điều gì: TLE/RE/MLE thì output dở
            dang hoặc rỗng, đặt cạnh expected chỉ gây hiểu nhầm là "sai đáp án". */}
        {result.verdict === 'WA' && got !== null && want !== null ? (
          <OutputDiff
            position={result.position}
            input={testcase?.inputPreview ?? null}
            got={got}
            want={want}
            compareMode={compareMode}
            gotLabel="lời giải mẫu in ra"
            wantLabel="expected trong bộ test"
          />
        ) : got ? (
          <div>
            <p className="mb-1 font-mono text-[10px] tracking-[0.14em] text-(--label) uppercase">
              Lời giải mẫu in ra
            </p>
            <pre className="max-h-32 overflow-auto border border-line bg-surface-1 p-2 font-mono text-xs whitespace-pre-wrap">
              {got}
            </pre>
          </div>
        ) : (
          <p className="text-xs text-ink-5">Lời giải mẫu không in ra gì.</p>
        )}

        {result.stderr ? (
          <div>
            <p className="mb-1 font-mono text-[10px] tracking-[0.14em] text-(--label) uppercase">stderr</p>
            <pre className="max-h-24 overflow-auto border border-line bg-surface-1 p-2 font-mono text-xs whitespace-pre-wrap text-clay">
              {result.stderr}
            </pre>
          </div>
        ) : null}
      </div>
    </section>
  )
}
