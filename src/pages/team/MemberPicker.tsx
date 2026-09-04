/**
 * Panel trái của trang thành viên: chọn NGƯỜI ở trên, chọn LƯỢT NỘP ở dưới.
 *
 * Hai danh sách chồng nhau chứ không phải hai bước tách rời: leader rà nhóm bằng cách
 * nhảy người này sang người kia rồi liếc vài lượt nộp gần nhất, nên đổi người mà mất
 * luôn danh sách bài là bắt họ đi lại từ đầu mỗi lần.
 */
import { Link } from 'react-router-dom'
import { EmptyState, Spinner, VerdictBadge } from '@/components/ui'
import { Avatar } from '@/components/ui/patterns'
import type { TeamSubmissionRow, TeamView } from './types'

const gio = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })

export function MemberPicker({
  members,
  currentUserId,
  submissions,
  currentSubmissionId,
  onPickSubmission,
}: {
  members: TeamView['members']
  currentUserId: string
  /** `null` = đang tải. */
  submissions: TeamSubmissionRow[] | null
  currentSubmissionId: string | null
  onPickSubmission: (id: string) => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-line">
        <p className="px-3.5 py-2.5 font-mono text-[11px] tracking-[0.14em] text-[var(--label)] uppercase">Thành viên</p>
        <nav aria-label="Chuyển thành viên" className="flex flex-col gap-px bg-line">
          {members.map((m) => {
            const dang = m.id === currentUserId
            return (
              <Link
                key={m.id}
                to={`/team/thanh-vien/${m.id}`}
                aria-current={dang ? 'page' : undefined}
                className={`flex items-center gap-2.5 px-3.5 py-2 text-[13px] no-underline transition-colors duration-[120ms] ease-linear ${
                  dang
                    ? 'bg-[var(--color-primary-soft)] font-semibold text-ink-1 shadow-[inset_2px_0_0_var(--moss)]'
                    : 'bg-surface-2 text-ink-3 hover:bg-surface-sel hover:text-ink-1'
                }`}
              >
                <Avatar name={m.displayName} size={22} chars={1} />
                <span className="min-w-0 truncate">{m.displayName}</span>
                {m.isLeader ? (
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-brass uppercase">leader</span>
                ) : null}
              </Link>
            )
          })}
        </nav>
      </div>

      <p className="shrink-0 px-3.5 py-2.5 font-mono text-[11px] tracking-[0.14em] text-[var(--label)] uppercase">
        Bài nộp {submissions ? `· ${submissions.length}` : ''}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!submissions ? (
          <div className="p-4">
            <Spinner />
          </div>
        ) : submissions.length === 0 ? (
          <EmptyState title="Chưa nộp bài nào" />
        ) : (
          <ul className="flex flex-col gap-px bg-line">
            {submissions.map((s) => {
              const dang = s.id === currentSubmissionId
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onPickSubmission(s.id)}
                    aria-current={dang ? 'true' : undefined}
                    className={`flex w-full items-start gap-2.5 px-3.5 py-2 text-left transition-colors duration-[120ms] ease-linear ${
                      dang ? 'bg-surface-sel shadow-[inset_2px_0_0_var(--moss)]' : 'bg-surface-2 hover:bg-surface-sel'
                    }`}
                  >
                    {/* Tên bài là dòng CHÍNH: danh sách chỉ có verdict và giờ thì
                        leader không biết đang xem bài nào, mà đó là câu hỏi đầu tiên. */}
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-[13px] text-ink-2">
                        {s.problemTitle ?? <span className="text-ink-6">(bài đã xoá)</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <VerdictBadge tone="soft" verdict={s.verdict} />
                        <span className="num font-mono text-[11px] text-ink-5">{s.score ?? '—'}đ</span>
                        <span className="num ml-auto font-mono text-[11px] whitespace-nowrap text-ink-6">
                          {gio(s.receivedAt)}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
