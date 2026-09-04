/**
 * Cột phải của màn 03 — tiến độ khoá, mentor, ngôn ngữ dùng được.
 *
 * Con số tiến độ là thứ to nhất trên màn này (44px mono): người học mở khoá ra là
 * để biết mình còn bao nhiêu bài, và câu trả lời đó không nên nằm trong một dòng
 * chữ 12px lẫn giữa những dòng khác.
 */
import { Avatar, Divider, Segments, SideLabel } from '@/components/ui/patterns'
import type { CourseDetail } from '@/types/api'
import type { SyllabusSection } from '../workspace/SyllabusPanel'

export function CourseSide({ course, sections }: { course: CourseDetail; sections: SyllabusSection[] }) {
  const problems = sections.flatMap((s) => s.items).filter((i) => i.kind === 'problem')
  const ac = problems.filter((i) => i.status === 'da-ac').length
  const total = problems.length
  const percent = total > 0 ? Math.round((ac / total) * 100) : 0
  const points = problems.reduce((sum, i) => sum + (i.points ?? 0), 0)

  return (
    <>
      {total > 0 ? (
        <section>
          <SideLabel>Tiến độ khoá</SideLabel>
          <p className="flex items-baseline gap-2">
            <span className="num font-mono text-[44px] leading-none font-semibold tracking-[-0.03em] text-ink-1">
              {percent}
            </span>
            <span className="num font-mono text-[20px] text-ink-5">%</span>
          </p>
          <div className="mt-3 mb-2.5">
            <Segments percent={percent} height={8} />
          </div>
          <p className="num font-mono text-[11px] text-ink-5">
            {ac}/{total} bài AC{points > 0 ? ` · ${Math.round(points)} điểm` : null}
          </p>
        </section>
      ) : null}

      {course.mentors.length > 0 ? (
        <>
          {total > 0 ? <Divider /> : null}
          <section>
            <SideLabel>Mentor của khoá</SideLabel>
            <ul className="flex flex-col gap-2.5">
              {course.mentors.map((m) => (
                <li key={m.email} className="flex items-center gap-2.5">
                  <Avatar name={m.displayName} size={28} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-ink-2">{m.displayName}</span>
                    <a
                      href={`mailto:${m.email}`}
                      className="block truncate font-mono text-[11px] text-ink-6 hover:text-ink-3 hover:underline"
                    >
                      {m.email}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {course.languages.length > 0 ? (
        <>
          <Divider />
          <section>
            <SideLabel>Ngôn ngữ được dùng</SideLabel>
            <ul className="flex flex-wrap gap-1.5">
              {course.languages.map((l) => (
                <li
                  key={l.id}
                  className="border border-line-strong px-2.5 py-1.5 font-mono text-[11px] text-ink-3"
                  title={l.name}
                >
                  {l.id}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </>
  )
}
