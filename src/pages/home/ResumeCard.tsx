/**
 * Thẻ "Làm tiếp dở dang" — khối nổi bật nhất của trang chủ (màn 02).
 *
 * Ý của thiết kế: người học mở judge lên là để làm tiếp bài hôm qua còn dở, nên thứ
 * đầu tiên trong tầm mắt phải là đúng bài đó cùng một nút vào thẳng màn làm bài —
 * không phải danh sách khoá để họ tự đi tìm.
 *
 * "Dở dang" = lần nộp gần nhất KHÔNG phải AC và còn link về màn làm bài. Bài đã AC
 * thì không còn gì để làm tiếp; bài không dựng được link thì nút sẽ dẫn đi đâu.
 * Không có bài nào như vậy thì thẻ biến mất hẳn, không hiện khung rỗng.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { VERDICT_LABEL, type CourseSummary } from '@/types/api'
import type { SyllabusSection } from '../workspace/SyllabusPanel'
import { workspaceLink, type RecentRow } from './recent'

function pickUnfinished(rows: RecentRow[]): { row: RecentRow; href: string } | null {
  for (const row of rows) {
    if (row.status !== 'done' || row.verdict === 'AC') continue
    const href = workspaceLink(row)
    if (href) return { row, href }
  }
  return null
}

export function ResumeCard() {
  const { data } = useQuery({
    queryKey: ['member', 'recent'],
    queryFn: () => api.get<RecentRow[]>('/api/member/submissions/recent?limit=12'),
  })
  const { data: courses } = useQuery({
    queryKey: ['member', 'courses'],
    queryFn: () => api.get<CourseSummary[]>('/api/member/courses'),
  })

  const found = data ? pickUnfinished(data) : null
  // Hai truy vấn dưới dùng ĐÚNG queryKey mà danh sách khoá và các dòng khoá đã gọi,
  // nên react-query trả từ cache — thẻ này không tự bắn thêm vòng mạng nào.
  const { data: sections } = useQuery({
    queryKey: ['member', 'syllabus', found?.row.courseId],
    queryFn: () => api.get<SyllabusSection[]>(`/api/member/courses/${found!.row.courseId}/syllabus`),
    enabled: Boolean(found?.row.courseId),
  })
  const { data: contests } = useQuery({
    queryKey: ['member', 'contests', 'meta'],
    queryFn: () => api.getWithMeta<{ id: string; title: string }[]>('/api/member/contests'),
    enabled: Boolean(found?.row.contestId),
  })

  if (!found) return null
  const { row, href } = found

  // "CS101 · Chương 2 · 5 lần nộp · lần cuối TLE" — bản vẽ nói đủ chỗ đứng của bài
  // trong khoá, không chỉ tên bài. Thiếu thứ nào thì bỏ thứ đó, không bịa.
  const code = courses?.find((c) => c.id === row.courseId)?.code
  const section = sections?.find((s) => s.items.some((i) => i.id === row.itemId))
  const item = section?.items.find((i) => i.id === row.itemId)
  // Bài trong CONTEST không có khoá/chương để nói, nên nói tên contest — chỗ đứng của
  // bài vẫn rõ. Thiếu thứ nào thì bỏ thứ đó chứ không bịa.
  const contest = contests?.data.find((c) => c.id === row.contestId)?.title
  const meta = [
    contest ?? code,
    contest ? null : section?.title,
    item && item.attempts > 0 ? `${item.attempts} lần nộp` : null,
  ].filter(Boolean)

  return (
    <section className="mb-8 flex items-center gap-5 border border-line-strong bg-surface-2 p-5">
      <div className="min-w-0 flex-1">
        <h2 className="font-mono text-[12px] font-normal tracking-widest text-moss uppercase">Làm tiếp dở dang</h2>
        <p className="mt-2 truncate text-[20px] font-semibold text-ink-1">{row.problemTitle}</p>
        <p className="num mt-1.5 truncate font-mono text-[14px] text-ink-4">
          {meta.length > 0 ? `${meta.join(' · ')} · ` : ''}
          lần cuối{' '}
          {/* Tên tiếng Việt, không phải mã: "WA" là tiếng lóng của giới thi lập trình,
              mà đây là dòng chữ đầu tiên người mới vào CLB đọc trên trang chủ. Mã gốc
              lùi về `title`, đúng cách VerdictBadge đang làm. */}
          <span
            title={row.verdict ?? undefined}
            className={row.verdict === 'TLE' || row.verdict === 'MLE' ? 'text-earth' : 'text-clay'}
          >
            {row.verdict ? VERDICT_LABEL[row.verdict] : 'chưa chấm xong'}
          </span>
          {row.score !== null ? ` · ${row.score} đ` : null}
        </p>
      </div>
      <Link
        to={href}
        className="flex shrink-0 items-center gap-2.5 bg-(--moss-solid,var(--moss)) px-5 py-3 font-mono text-[14px] font-semibold text-on-accent uppercase transition-opacity duration-120 ease-linear hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
      >
        Làm tiếp <span aria-hidden>→</span>
      </Link>
    </section>
  )
}
