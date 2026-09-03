/**
 * Chi tiết MỘT testcase — phần thân của dải tab test trong `ResultTable`.
 *
 * Trước đây mỗi test sai tự mở một bảng so ngay dưới dòng của nó, nên một lượt chấm
 * sai 5 test là 5 khối giống hệt nhau xếp chồng, mỗi khối lặp lại đủ tiêu đề "input",
 * "output của bạn", "đáp án đúng". Màn hình dài ra mà không thêm tin: người học chỉ đọc
 * được một khối tại một thời điểm. Giờ chọn test ở dải chip, đọc ở đây.
 *
 * Bảng so CHỈ mở khi verdict là WA. Quá thời gian mà cũng dựng diff thì dòng "khác từ
 * dòng 1" nói sai nguyên nhân — chương trình bị cắt giữa chừng, không phải tính sai.
 */
import { VerdictBadge } from '@/components/ui'
import type { ResultView, SampleIO } from '@/types/api'
import { formatDuration, formatMemory } from './format'
import { OutputDiff } from './OutputDiff'

export function ResultCase({
  result,
  sample,
  compareMode,
}: {
  result: ResultView
  /** Testcase mẫu ghép theo `position`; `null` với test ẩn hoặc bài không công bố mẫu. */
  sample: SampleIO | null
  compareMode: string
}) {
  // Test ẩn không bao giờ có stdout — serializer chặn ở máy chủ (NFR-2), không phải ở đây.
  const output = result.stdout ?? null
  const diffable = result.verdict === 'WA' && output !== null && sample?.expected != null

  return (
    <div className="border border-line bg-surface-2">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-2.5 py-1.5">
        <span className="num font-mono text-[12px] text-ink-4">
          test #{result.position}
        </span>
        <span className="font-mono text-[12px] text-ink-6">{result.isSample ? 'mẫu' : 'ẩn'}</span>
        <VerdictBadge tone="soft" verdict={result.verdict} />
        {result.detail ? <span className="font-mono text-[12px] text-ink-6">{result.detail}</span> : null}
        <span className="num ml-auto font-mono text-[12px] text-ink-6">
          {formatDuration(result.timeMs)} · {formatMemory(result.memoryKb)}
        </span>
      </div>

      {diffable ? (
        <OutputDiff
          position={result.position}
          input={sample.input}
          got={output ?? ''}
          want={sample.expected!}
          compareMode={compareMode}
        />
      ) : (
        <Plain result={result} sample={sample} output={output} />
      )}

      {result.stderr ? <Field label="stderr" text={result.stderr} tone="wa" /> : null}
    </div>
  )
}

/**
 * Mọi trường hợp không dựng được bảng so: test ẩn, test đúng, hoặc test sai vì lý do
 * khác WA. Không có gì để đối chiếu thì vẫn đưa ra thứ đang có — im lặng ở đây nghĩa là
 * người học bấm vào một test rồi thấy khoảng trống.
 */
function Plain({
  result,
  sample,
  output,
}: {
  result: ResultView
  sample: SampleIO | null
  output: string | null
}) {
  if (!result.isSample) {
    return (
      <p className="px-2.5 py-2 font-mono text-[12px] text-ink-6">
        Test ẩn — đề không công bố input lẫn đáp án của test này. Chỉ có verdict, thời gian và bộ nhớ ở trên.
      </p>
    )
  }

  return (
    <>
      {sample?.input != null ? <Field label="input" text={sample.input} /> : null}
      <Field label="output của bạn" text={output === null || output === '' ? '(rỗng)' : output} />
      {/* Test mẫu ĐÚNG thì không cần in lại đáp án — nó bằng đúng output ở trên, mà
          nhắc lại chỉ làm khối này dài thêm. Sai vì TLE/RE thì đáp án cũng không phải
          thứ đang thiếu: cái thiếu là chương trình chạy xong. */}
    </>
  )
}

function Field({ label, text, tone }: { label: string; text: string; tone?: 'wa' }) {
  return (
    <div className="border-t border-line px-2.5 py-1.5 first:border-t-0">
      <p className={`font-mono text-[12px] ${tone === 'wa' ? 'text-[var(--color-wa)]' : 'text-ink-6'}`}>{label}</p>
      <pre
        className={`mt-0.5 max-h-40 overflow-auto font-mono text-[13px] whitespace-pre ${
          tone === 'wa' ? 'text-[var(--color-wa)]' : 'text-ink-3'
        }`}
      >
        {text}
      </pre>
    </div>
  )
}
