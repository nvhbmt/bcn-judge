import { Markdown } from '@/components/markdown/Markdown'
import type { ProblemView } from '@/types/api'

/** Tab "Đề bài" (FR-D1): đề, mô tả input/output, ràng buộc, ví dụ, giới hạn. */
export function StatementPanel({ problem }: { problem: ProblemView }) {
  return (
    <article className="space-y-4 px-4 py-4">
      <header>
        <h1 className="text-lg font-semibold">{problem.title}</h1>
        <p className="mt-1 font-mono text-xs text-ink-5">
          Thời gian {problem.timeLimitMs} ms · Bộ nhớ {problem.memoryLimitMb} MB
          {problem.hiddenTestcaseCount > 0 ? ` · ${problem.hiddenTestcaseCount} testcase ẩn` : ''}
        </p>
      </header>

      {/* Bài dạng function: người học phải biết đừng viết main, nếu không sẽ CE vì
          trùng điểm vào với harness — và thông báo của trình biên dịch lúc đó rất
          khó hiểu với người mới. */}
      {problem.kind === 'function' ? (
        <p className="bg-[var(--tint-earth)] px-3 py-2 text-sm text-earth">
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
          <h2 className="mb-2 text-sm font-semibold">Ví dụ</h2>
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

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      <Markdown source={body} />
    </section>
  )
}

function IoBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="overflow-hidden border border-line">
      <div className="border-b border-line bg-surface-1 px-2 py-1 text-xs font-medium text-ink-5">
        {label}
      </div>
      <pre className="overflow-x-auto px-2 py-1.5 font-mono text-xs whitespace-pre-wrap">{text}</pre>
    </div>
  )
}
