import { Markdown } from '@/components/markdown/Markdown'
import { SectionRule } from '@/components/ui'
import { StatStrip } from '@/components/ui/patterns'
import { DIFFICULTY_LABEL } from '@/pages/mentor/types'
import type { ProblemView } from '@/types/api'

/** Tab "Đề bài" (FR-D1): đề, mô tả input/output, ràng buộc, ví dụ, giới hạn. */
export function StatementPanel({
  problem,
  headingLevel = 1,
}: {
  problem: ProblemView
  /**
   * Bậc thẻ tiêu đề. Mặc định `h1` vì ở màn làm bài, tên bài LÀ tiêu đề của trang.
   *
   * Khung xem trước của mentor truyền 2: ở đó tiêu đề trang đã là tên bài trên thanh
   * trên cùng, nên để `h1` là trang có hai `h1` — trình đọc màn hình mất mốc điều
   * hướng, và đó cũng đúng thứ bộ e2e bắt được khi khung xem trước dùng lại panel này.
   */
  headingLevel?: 1 | 2
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return (
    /* 16px (--text-lg của hệ) chứ không phải 14px mặc định của app: đây là đoạn văn
       người ta đọc CHĂM CHÚ trong nhiều phút giữa lúc thi, khác hẳn nhãn và số liệu
       ở phần còn lại của giao diện. Khung rộng ~616px nên 16px ra khoảng 75 ký tự
       mỗi dòng — đúng khoảng dễ đọc, không phải nới bừa.
       Đặt ở <article> để MỌI khối markdown trong panel (đề, dữ liệu vào/ra, ghi chú)
       cùng lớn lên; tiêu đề và nhãn đã khai cỡ riêng nên không đổi. */
    <article className="space-y-5 px-5 py-5 text-[16px]">
      <header>
        <Heading className="font-display text-[24px] text-ink-1">{problem.title}</Heading>

        {/* Độ khó và tag đứng DƯỚI tiêu đề: tên bài là thứ mắt tìm trước, hai thứ này
            chỉ để liếc sau khi đã biết đang đọc bài nào. Độ khó tô theo màu ngữ nghĩa
            của hệ (moss/earth/clay) thay vì viền xám — xám thì nó chìm lẫn vào tag. */}
        {problem.difficulty || problem.tags.length > 0 ? (
          <p className="mt-2.5 flex flex-wrap items-center gap-2.5">
            {problem.difficulty ? (
              <span
                className={`border px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.1em] uppercase ${
                  DIFFICULTY_CLASS[problem.difficulty] ?? 'border-line-strong text-ink-4'
                }`}
              >
                {DIFFICULTY_LABEL[problem.difficulty] ?? problem.difficulty}
              </span>
            ) : null}
            {problem.tags.length > 0 ? (
              <span className="font-mono text-[13px] text-ink-6">{problem.tags.join(' · ')}</span>
            ) : null}
          </p>
        ) : null}
      </header>

      {/* Bài dạng function: người học phải biết đừng viết main, nếu không sẽ CE vì
          trùng điểm vào với harness — và thông báo của trình biên dịch lúc đó rất
          khó hiểu với người mới. */}
      {problem.kind === 'function' ? (
        <p className="border-l-2 border-earth bg-[var(--tint-earth)] px-3 py-2.5 text-[14px] text-ink-3">
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
            <p className="mt-3 font-mono text-[13px] text-ink-6">
              Thừa dấu cách cuối dòng hay một dòng trống ở cuối thì không bị tính sai.
            </p>
          ) : (
            <p className="mt-3 font-mono text-[13px] text-earth">
              Bài này so khớp CHÍNH XÁC từng ký tự — thừa một dấu cách cũng bị tính sai.
            </p>
          )}
        </section>
      ) : null}

      {/* Dải số liệu xuống CUỐI: thời gian, bộ nhớ, số test ẩn là thứ tra lúc đã đọc
          xong đề và đang cân nhắc thuật toán — đặt trên đầu thì nó chen giữa tên bài
          và nội dung, mà lúc đó chưa ai cần tới. Có NHÃN cho từng ô vì "1000 ms ·
          256 MB · 3" đọc trần thì phải đoán số nào là gì. */}
      <section>
        <SectionRule label="Giới hạn" />
        <div className="mt-2">
          <StatStrip
            items={[
              { label: 'Thời gian', value: `${problem.timeLimitMs} ms` },
              { label: 'Bộ nhớ', value: `${problem.memoryLimitMb} MB` },
              { label: 'Test ẩn', value: problem.hiddenTestcaseCount },
            ]}
          />
        </div>
      </section>
    </article>
  )
}

/** Màu theo ngữ nghĩa của hệ: dễ = moss, trung bình = earth, khó = clay. */
const DIFFICULTY_CLASS: Record<string, string> = {
  easy: 'border-moss bg-[var(--color-primary-soft)] text-moss',
  medium: 'border-earth bg-[var(--tint-earth)] text-earth',
  hard: 'border-clay bg-[var(--tint-clay)] text-clay',
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
      <pre className="overflow-x-auto px-2 py-2 font-mono text-[13px] whitespace-pre-wrap text-ink-2">{text}</pre>
    </div>
  )
}
