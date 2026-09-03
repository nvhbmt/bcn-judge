/**
 * Bài nộp của một thành viên, góc nhìn leader — CHỈ ĐỌC (màn 06, FR-J3/J4).
 *
 * Contest còn đang chạy thì source bị khoá tới giờ đóng: leader cũng là thí sinh, nên
 * cho họ đọc code của đồng đội giữa contest là mở một đường gian lận. Bản vẽ đánh dấu
 * chỗ đó bằng 🔒 — đây là pictograph DUY NHẤT cả hệ thiết kế cho phép, đúng vì nó nói
 * "khoá theo giờ" nhanh hơn mọi câu chữ.
 *
 * Máy chủ mới là chỗ quyết định: nó trả `source: null`. Ở đây chỉ trình bày.
 */
import { useQuery } from '@tanstack/react-query'
import { EmptyState, SectionRule, Spinner, VerdictBadge } from '@/components/ui'
import { api } from '@/lib/api'
import type { TeamSubmissionRow } from './types'

export function TeamSubmissions({
  teamId,
  userId,
  memberName,
}: {
  teamId: string
  userId: string
  memberName: string
}) {
  const { data } = useQuery({
    queryKey: ['team', teamId, 'submissions', userId],
    queryFn: () => api.get<TeamSubmissionRow[]>(`/api/member/teams/${teamId}/submissions?userId=${userId}`),
  })

  if (!data) return <Spinner />

  return (
    <section>
      <SectionRule label={`Bài nộp của ${memberName}`} meta="chỉ đọc" />
      {data.length === 0 ? (
        <EmptyState title="Thành viên này chưa nộp bài nào" />
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {data.map((s) => (
            <li key={s.id} className="border border-line bg-surface-2">
              <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
                <VerdictBadge tone="soft" verdict={s.verdict} />
                <span className="num font-mono text-[12px] text-ink-3">{s.score ?? '—'} đ</span>
                <span className="num font-mono text-[11px] text-ink-5">{s.languageId}</span>
                <span className="num ml-auto font-mono text-[11px] text-ink-6">
                  {new Date(s.receivedAt).toLocaleString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </span>
              </div>

              {/* Khối code dùng `--surface-editor`, KHÔNG phải `--surface-3`: bản vẽ cho mọi
                  vùng mã nguồn cùng một mặt phẳng, và ở nền sáng nó là mặt sáng NHẤT. */}
              {s.source ? (
                <pre className="max-h-56 overflow-auto bg-surface-editor px-4 py-3 font-mono text-[12px] leading-[1.7] text-ink-3">
                  {s.source}
                </pre>
              ) : (
                <p className="px-4 py-3 font-mono text-[11px] text-ink-5">
                  <span aria-hidden>🔒 </span>
                  contest đang diễn ra — xem code sau{' '}
                  {s.sourceEmbargoedUntil
                    ? new Date(s.sourceEmbargoedUntil).toLocaleString('vi-VN')
                    : 'khi kết thúc'}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
