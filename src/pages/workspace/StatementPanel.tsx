import { Markdown } from '@/components/markdown/Markdown'
import { SectionRule } from '@/components/ui'
import type { ProblemView } from '@/types/api'

/** Tab "Đề bài" (FR-D1): đề, mô tả input/output, ràng buộc, ví dụ, giới hạn. */
export function StatementPanel({ problem }: { problem: ProblemView }) {
  return (
    <article className="space-y-5 px-5 py-5">
      <header>
        <h1 className="font-display text-[24px] text-ink-1">{problem.title}</h1>
        {/* Mọi con số dùng mono + tabular-nums: hai bài cạnh nhau phải thẳng cột. */}
        <p className="num mt-1.5 font-mono text-[11px] text-ink-5">
          {problem.timeLimitMs} ms · {problem.memoryLimitMb} MB
          {problem.hiddenTestcaseCount > 0 ? ` · ${problem.hiddenTestcaseCount} testcase ẩn` : ''}
        </p>
      </header>

      {/* Bài dạng function: người học phải biết đừng viết main, nếu không sẽ CE vì
          trùng điểm vào với harness — và thông báo của trình biên dịch lúc đó rất
          khó hiểu với người mới. */}
      {problem.kind === 'function' ? (
        <p className="border-l-2 border-earth bg-[var(--tint-earth)] px-3 py-2.5 text-[13px] text-ink-3">
          Bài dạng <strong>hàm</strong>: chỉ viết đúng hàm theo mẫu có sẵn trong trình soạn thảo.{' '}
          <strong>Đừng viết hàm main</strong> — phần đọc dữ liệu và in kết quả đã có sẵn.
        </p>
      ) : null}

      <Markdown source={problem.statementMd} />

      {problem.inputDescMd ? <Section title="Dữ liệu vào" body={problem.inputDescMd} /> : null}
      {problem.outputDescMd ? <Section title="Dữ liệu ra" body={problem.outputDescMd} /> : null}
      {problem.constraintsMd ? <Section title="Ràng buộc" body={problem.constraintsMd} /> : null}

      {problem.samples.length > 0 ? (
        <section>
          <SectionRule label="Ví dụ" meta={`${problem.samples.length} testcase mẫu`} />
          <div className="h-3" />
          <div className="space-y-3">
            {problem.samples.map((sample) => (
              <div key={sample.position} className="grid gap-2 sm:grid-cols-2">
                <IoBox label="Input" text={sample.input} />
                <IoBox label="Output" text={sample.expected ?? ''} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  )
}

/** Mỗi mục của đề dùng chung motif đường kẻ — xem SectionRule. */
function Section({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <SectionRule label={title} />
      <div className="mt-2">
        <Markdown source={body} />
      </div>
    </section>
  )
}

function IoBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="overflow-hidden border border-line bg-surface-2">
      <div className="border-b border-line bg-surface-1 px-2 py-1 font-mono text-[10px] tracking-[0.14em] text-ink-6 uppercase">
        {label}
      </div>
      <pre className="overflow-x-auto px-2 py-2 font-mono text-[12px] whitespace-pre-wrap text-ink-2">{text}</pre>
    </div>
  )
}
