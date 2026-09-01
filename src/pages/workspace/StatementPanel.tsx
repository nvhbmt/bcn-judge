import { Markdown } from '@/components/markdown/Markdown'
import type { ProblemView } from '@/types/api'

/** Tab "Đề bài" (FR-D1): đề, mô tả input/output, ràng buộc, ví dụ, giới hạn. */
export function StatementPanel({ problem }: { problem: ProblemView }) {
  return (
    <article className="space-y-4 px-4 py-4">
      <header>
        <h1 className="text-lg font-semibold">{problem.title}</h1>
        <p className="mt-1 font-mono text-xs text-slate-500">
          Thời gian {problem.timeLimitMs} ms · Bộ nhớ {problem.memoryLimitMb} MB
          {problem.hiddenTestcaseCount > 0 ? ` · ${problem.hiddenTestcaseCount} testcase ẩn` : ''}
        </p>
      </header>

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
    <div className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
      <div className="border-b border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800">
        {label}
      </div>
      <pre className="overflow-x-auto px-2 py-1.5 font-mono text-xs whitespace-pre-wrap">{text}</pre>
    </div>
  )
}
