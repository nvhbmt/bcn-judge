/**
 * Bài nộp của MỘT thành viên — hai panel (FR-J3/J4).
 *
 * Trái: chọn người, rồi chọn lượt nộp. Phải: mã nguồn của lượt đang chọn.
 *
 * Vì sao KHÔNG đổ cả danh sách kèm mã như bản trước: một thành viên chăm chỉ có vài
 * chục lượt, mỗi lượt một khối mã — cuộn dọc hơn 6000px, và muốn so hai lượt thì phải
 * nhớ bằng đầu. Hai panel giữ danh sách đứng yên trong khi mã đổi, nên nhảy giữa các
 * lượt là một cú bấm chứ không phải một hành trình cuộn.
 *
 * Chọn người nằm ở URL, chọn lượt nộp nằm ở state: đổi người là đổi thứ đang xem
 * (đáng có nút Back), còn lướt qua các lượt của cùng một người thì không.
 */
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { SplitPane } from '@/components/layout/SplitPane'
import { EmptyState, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { MemberPicker } from './team/MemberPicker'
import { SubmissionDetail } from '@/components/submission/SubmissionDetail'
import type { LanguageOption } from '@/types/api'
import type { TeamSubmissionRow, TeamView } from './team/types'

export function TeamMemberPage() {
  const { userId } = useParams()
  const [picked, setPicked] = useState<string | null>(null)

  const { data: team, isLoading } = useQuery({
    queryKey: ['team', 'mine'],
    queryFn: () => api.get<TeamView | null>('/api/member/teams/mine'),
  })
  // Bảng `languages` là nguồn duy nhất nói ngôn ngữ nào tô kiểu gì (`cmMode`); chép
  // tay một bảng ánh xạ ở client thì admin thêm ngôn ngữ là nó lệch ngay.
  const { data: languages } = useQuery({
    queryKey: ['languages'],
    queryFn: () => api.get<LanguageOption[]>('/api/member/languages'),
    staleTime: Infinity,
  })
  const { data: submissions } = useQuery({
    queryKey: ['team', team?.id, 'submissions', userId],
    queryFn: () =>
      api.get<TeamSubmissionRow[]>(`/api/member/teams/${team!.id}/submissions?userId=${userId}`),
    enabled: Boolean(team?.isLeader && userId),
  })

  if (isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }

  // Không phải leader (hoặc không có team) thì trang này không có gì để hiện. Đưa về
  // /team chứ không dựng màn báo lỗi riêng — server đã chặn 403, đây chỉ là lớp che.
  if (!team?.isLeader) return <Navigate to="/team" replace />

  const member = team.members.find((m) => m.id === userId)
  if (!member) {
    return (
      <div className="px-7 py-8">
        <Link to="/team" className="mb-3 inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-5 hover:text-ink-2">
          <ArrowLeft size={13} /> ~/team
        </Link>
        <h1 className="mb-4 font-display text-[24px] text-ink-1">Không có thành viên này</h1>
        <EmptyState title="Người này không thuộc team của bạn" hint="Có thể họ vừa được chuyển sang team khác." />
      </div>
    )
  }

  // Mặc định mở lượt MỚI NHẤT: đó là câu hỏi "gần đây bạn ấy làm sao rồi" mà leader
  // mở trang này để hỏi. `picked` chỉ thắng khi lượt đó còn thuộc về người đang xem —
  // không thì đổi người xong panel phải vẫn hiện mã của người trước.
  const current =
    submissions?.find((s) => s.id === picked) ?? submissions?.[0] ?? null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-surface-1 px-5 py-2.5">
        <Link to="/team" className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-5 hover:text-ink-2">
          <ArrowLeft size={13} /> ~/team · {team.name}
        </Link>
        <h1 className="truncate font-display text-[16px] text-ink-1">{member.displayName}</h1>
        {member.isLeader ? <span className="font-mono text-[10px] text-brass uppercase">leader</span> : null}
      </header>

      <div className="min-h-0 flex-1">
        <SplitPane
          storageKey="bcn:team-member"
          defaultRatio={0.34}
          minPx={280}
          left={
            <MemberPicker
              members={team.members}
              currentUserId={member.id}
              submissions={submissions ?? null}
              currentSubmissionId={current?.id ?? null}
              onPickSubmission={setPicked}
            />
          }
          right={<SubmissionDetail submission={current} languages={languages ?? []} />}
        />
      </div>
    </div>
  )
}
