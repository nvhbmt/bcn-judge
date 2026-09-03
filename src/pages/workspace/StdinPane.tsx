/**
 * Tab "stdin tự nhập": ô nhập, nút chạy và output — cả ba trong cùng một tab.
 *
 * Trước đó ba việc này nằm ở ba chỗ: gõ input ở tab này, bấm Chạy ở thanh trên editor,
 * rồi phải nhảy sang tab "chạy thử" mới thấy kết quả. Vòng lặp thử-một-input là thao
 * tác lặp nhiều nhất khi đang gỡ lỗi, nên bắt đổi tab mỗi vòng là bắt trả phí đúng chỗ
 * đắt nhất. Gom lại: gõ, bấm, đọc, sửa — không rời tab.
 *
 * Nút ở đây LUÔN chạy với input tự nhập, còn nút trên thanh editor luôn chạy testcase
 * mẫu. Trước kia một nút đoán ý theo chỗ ô nhập có chữ hay không — cùng một cú bấm ra
 * hai hành vi khác nhau, mà không có gì trên màn hình nói điều đó.
 */
import { Button, VerdictBadge } from '@/components/ui'
import type { SubmissionView } from '@/types/api'

export function StdinPane({
  value,
  onChange,
  onRun,
  busy,
  pending,
  result,
  sampleInput,
}: {
  value: string
  onChange: (v: string) => void
  onRun: () => void
  busy: 'run' | 'submit' | null
  /**
   * Đã gửi lượt chạy nhưng kết quả đầu tiên chưa về. Không có cờ này thì trong khoảng
   * giữa lúc `busy` tắt và lúc dữ liệu tới, pane quay lại đúng câu "bấm Chạy để xem
   * output" — ngay sau khi người ta vừa bấm Chạy.
   */
  pending: boolean
  /** Kết quả của lượt chạy TỰ NHẬP gần nhất; `null` khi chưa chạy lần nào. */
  result: SubmissionView | null
  /**
   * Input của testcase mẫu đầu tiên, dùng làm placeholder.
   *
   * Ô trống không nói được định dạng đầu vào, mà đó đúng là thứ người ta gõ sai nhiều
   * nhất — ba số một dòng hay mỗi số một dòng? Mẫu thật trả lời ngay, và nó vốn đã in
   * trong đề nên không lộ gì thêm. Bài chưa có testcase mẫu thì rơi về câu chung.
   */
  sampleInput?: string
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-3">
        <label className="font-mono text-[13px] text-ink-5" htmlFor="custom-input">
          Chương trình đọc đúng những gì bạn gõ ở đây.
        </label>
        <Button size="sm" className="ml-auto" onClick={onRun} disabled={busy !== null}>
          {busy === 'run' ? 'Đang chạy…' : 'Chạy với input này'}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-line sm:grid-cols-2">
        <textarea
          id="custom-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            sampleInput?.trim()
              ? `Ví dụ — input của testcase mẫu:\n\n${sampleInput.trimEnd()}`
              : 'Gõ dữ liệu vào ở đây, đúng định dạng đề mô tả.'
          }
          spellCheck={false}
          className="min-h-0 resize-none bg-surface-editor px-2.5 py-2 font-mono text-[12px] text-ink-2 placeholder:text-ink-6 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-moss"
        />
        <div className="min-h-0 overflow-auto bg-surface-editor px-2.5 py-2">
          <Output busy={busy === 'run' || pending} result={result} />
        </div>
      </div>
    </div>
  )
}

function Output({ busy, result }: { busy: boolean; result: SubmissionView | null }) {
  if (busy) return <Hint>đang chạy…</Hint>
  if (!result) return <Hint>output hiện ở đây sau khi bấm Chạy.</Hint>

  if (result.compileOutput) {
    return (
      <div>
        <Label tone="wa">lỗi biên dịch</Label>
        <pre className="mt-1 font-mono text-[12px] whitespace-pre-wrap text-ink-2">{result.compileOutput}</pre>
      </div>
    )
  }

  const r = result.results?.[0]
  if (!r) return <Hint>{result.status === 'done' ? 'không có output.' : 'đang chấm…'}</Hint>

  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Label>stdout</Label>
        {/* Chạy tự nhập KHÔNG có đáp án để so, nên "AC" ở đây chẳng nói lên điều gì —
            chỉ hiện verdict khi nó thật sự mang tin: TLE, RE, MLE. */}
        {r.verdict && r.verdict !== 'AC' ? <VerdictBadge verdict={r.verdict} /> : null}
        <span className="num ml-auto font-mono text-[13px] text-ink-6">
          {r.timeMs ?? '—'} ms{r.memoryKb ? ` · ${Math.round(r.memoryKb / 1024)} MB` : ''}
        </span>
      </div>

      <pre className="font-mono text-[12px] break-all whitespace-pre-wrap text-ink-2">
        {r.stdout ? r.stdout : <span className="text-ink-6">(rỗng)</span>}
      </pre>

      {r.stderr ? (
        <div className="border-t border-line pt-1.5">
          <Label tone="wa">stderr</Label>
          <pre className="mt-1 font-mono text-[12px] break-all whitespace-pre-wrap text-[var(--color-wa)]">
            {r.stderr}
          </pre>
        </div>
      ) : null}
    </div>
  )
}

function Hint({ children }: { children: string }) {
  return <p className="font-mono text-[13px] text-ink-6">{children}</p>
}

function Label({ children, tone }: { children: string; tone?: 'wa' }) {
  return (
    <span className={`font-mono text-[13px] ${tone === 'wa' ? 'text-[var(--color-wa)]' : 'text-ink-6'}`}>
      {children}
    </span>
  )
}
