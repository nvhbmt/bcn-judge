/**
 * Màn 06 của bản v2 — trang team (FR-J2/J3/J4).
 *
 * Tiến độ và bài nộp của cả nhóm chỉ leader thấy; guard thật nằm ở server, đây chỉ là
 * lớp che. Chip "BẠN LÀ LEADER" nói rõ vì sao mình thấy được những thứ người khác
 * không thấy — không có nó thì phần dữ liệu thừa ra trông như lỗi phân quyền.
 *
 * Ô "ghi chú của leader" (FR-J6) nay có thật. Trước đó tôi ghi là "backend chưa có chỗ
 * lưu" — SAI: ba endpoint đã nằm sẵn trong routes/member/teams.ts từ lâu, chỉ là
 * frontend chưa gọi cái nào, nên cả tính năng nằm đó không ai dùng được.
 */
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState, SectionRule, Spinner } from '@/components/ui'
import { Avatar } from '@/components/ui/patterns'
import { api } from '@/lib/api'
import { LeaderNote } from './team/LeaderNote'
import { TeamProgress } from './team/TeamProgress'
import { TeamSubmissions } from './team/TeamSubmissions'
import type { TeamView } from './team/types'

export function TeamPage() {
  const [openMember, setOpenMember] = useState<string | null>(null)
  const { data: team, isLoading, isError } = useQuery({
    queryKey: ['team', 'mine'],
    queryFn: () => api.get<TeamView | null>('/api/member/teams/mine'),
  })

  if (isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }

  // Lỗi gọi API KHÁC hẳn "không có team", dù cả hai đều cho `team` rỗng. Gộp chung thì
  // một sự cố máy chủ hiện ra thành "Bạn chưa thuộc team nào" — người dùng đi hỏi
  // quản lý viên vì sao bị loại khỏi nhóm, trong khi thật ra chỉ cần tải lại trang.
  if (isError) {
    return (
      <Shell>
        <h1 className="font-display text-[28px] text-ink-1">Team</h1>
        <EmptyState title="Không đọc được thông tin team" hint="Tải lại trang, hoặc báo mentor nếu vẫn lỗi." />
      </Shell>
    )
  }

  if (!team) {
    return (
      <Shell>
        {/* Vẫn phải có h1: màn hình không tiêu đề thì người dùng trình đọc màn
            hình không biết mình đang ở đâu, và tab trình duyệt cũng vô danh. */}
        <h1 className="font-display text-[28px] text-ink-1">Team</h1>
        <EmptyState title="Bạn chưa thuộc team nào" hint="Quản lý viên sẽ xếp bạn vào team." />
      </Shell>
    )
  }

  const openName = team.members.find((m) => m.id === openMember)?.displayName ?? ''

  return (
    <Shell>
      <header className="mb-7">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[28px] text-ink-1">{team.name}</h1>
          {team.isLeader ? (
            <span className="border border-brass px-2.5 py-1 font-mono text-[11px] tracking-[0.06em] text-brass uppercase">
              Bạn là leader
            </span>
          ) : null}
        </div>
        <p className="num mt-2 font-mono text-[12px] text-ink-5">
          {team.members.length} thành viên
          {team.createdAt ? ` · lập ${new Date(team.createdAt).toLocaleDateString('vi-VN')}` : ''}
        </p>
      </header>

      <section className="mb-8">
        <SectionRule label="Thành viên" meta={`${team.members.length} người`} />
        <ul className="mt-3 flex flex-wrap gap-2">
          {team.members.map((m) => (
            <li
              key={m.id}
              className={`inline-flex items-center gap-2.5 border px-3 py-2 text-[13px] ${
                m.isLeader ? 'border-brass text-ink-1' : 'border-line text-ink-3'
              }`}
            >
              <Avatar name={m.displayName} size={24} />
              {m.displayName}
              {m.isLeader ? <span className="font-mono text-[10px] text-brass uppercase">leader</span> : null}
            </li>
          ))}
        </ul>
      </section>

      {team.isLeader ? (
        <>
          <TeamProgress teamId={team.id} onPick={setOpenMember} />
          <LeaderNote teamId={team.id} members={team.members} />
          {openMember ? (
            <TeamSubmissions teamId={team.id} userId={openMember} memberName={openName} />
          ) : (
            <p className="text-[13px] text-ink-5">Bấm tên một thành viên ở bảng trên để xem bài nộp của họ.</p>
          )}
        </>
      ) : (
        <p className="text-[13px] text-ink-5">Chỉ leader xem được tiến độ và bài nộp của cả team.</p>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <PageContainer>{children}</PageContainer>
}
