import { Markdown } from '@/components/markdown/Markdown'
import { SectionRule } from '@/components/ui'
import { StatStrip } from '@/components/ui/patterns'
import { DIFFICULTY_LABEL } from '@/pages/mentor/types'
import type { ProblemView } from '@/types/api'

/** Tab "Đề bài" (FR-D1): đề, mô tả input/output, ràng buộc, ví dụ, giới hạn. */
export function StatementPanel({ problem }: { problem: ProblemView }) {
  return (
    <article className="space-y-5 px-5 py-5">
      <header>
        {/* Độ khó và tag đứng TRÊN tiêu đề theo bản vẽ: chúng là thứ người học liếc để
            quyết định có làm bài này bây giờ không, nên phải gặp trước cái tên. */}
        {problem.difficulty || problem.tags.length > 0 ? (
          <p className="mb-2.5 flex flex-wrap items-center gap-2.5">
            {problem.difficulty ? (
              <span className="border border-line-strong px-2 py-1 font-mono text-[10px] tracking-[0.1em] text-ink-4 uppercase">
                {DIFFICULTY_LABEL[problem.difficulty] ?? problem.difficulty}
              </span>
            ) : null}
            {problem.tags.length > 0 ? (
              <span className="font-mono text-[11px] text-ink-6">{problem.tags.join(' · ')}</span>
            ) : null}
          </p>
        ) : null}

        <h1 className="font-display text-[24px] text-ink-1">{problem.title}</h1>

        {/* Dải số liệu có NHÃN thay cho một dòng số trần: bản vẽ tách thời gian · bộ
            nhớ · test ẩn thành ba ô, vì "1000 ms · 256 MB · 3" đọc trần thì phải đoán
            số nào là gì. Mọi con số dùng mono + tabular-nums. */}
        <div className="mt-3.5">
          <StatStrip
            items={[
              { label: 'Thời gian', value: `${problem.timeLimitMs} ms` },
              { label: 'Bộ nhớ', value: `${problem.memoryLimitMb} MB` },
              { label: 'Test ẩn', value: problem.hiddenTestcaseCount },
            ]}
          />
        </div>
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
                <IoBox label="stdin" text={sample.input} />
                <IoBox label="stdout" text={sample.expected ?? ''} />
              </div>
            ))}
          </div>

          {/* Luật chấm nói thẳng ra. Người mới học mất hàng giờ đi tìm một lỗi không
              tồn tại vì tưởng thừa một dòng trống là sai. */}
          {problem.compareMode !== 'exact' ? (
            <p className="mt-3 font-mono text-[11px] text-ink-6">
              Thừa dấu cách cuối dòng hay một dòng trống ở cuối thì không bị tính sai.
            </p>
          ) : (
            <p className="mt-3 font-mono text-[11px] text-earth">
              Bài này so khớp CHÍNH XÁC từng ký tự — thừa một dấu cách cũng bị tính sai.
            </p>
          )}
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
