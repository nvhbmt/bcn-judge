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
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState, SectionRule, Spinner } from '@/components/ui'
import { SideColumn, SidePanel } from '@/components/ui/patterns'
import { api } from '@/lib/api'
import { LeaderNote } from './team/LeaderNote'
import { TeamMembers } from './team/TeamMembers'
import { TeamStandings } from './team/TeamStandings'
import type { TeamView } from './team/types'

export function TeamPage() {
  const { data: team, isLoading, isError } = useQuery({
    queryKey: ['team', 'mine'],
    queryFn: () => api.get<TeamView | null>('/api/member/teams/mine'),
  })

  if (isLoading) {
    return (
      <Shell>
        <div className="grid h-64 place-items-center">
          <Spinner />
        </div>
      </Shell>
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
        {/* Bấm một người là sang TRANG RIÊNG của họ (TeamMemberPage) — xem
            TeamMembers.tsx. Trước đây mọi thứ đổ ra cùng lúc và thứ bấm được lại
            trông giống chữ thường nhất. */}
        <div className="mt-3">
          <TeamMembers team={team} />
        </div>
      </section>

      {team.isLeader ? (
        <LeaderNote teamId={team.id} members={team.members} />
      ) : (
        <p className="text-[13px] text-ink-5">Chỉ leader xem được tiến độ và bài nộp của cả team.</p>
      )}
    </Shell>
  )
}

/**
 * Khung hai cột của màn team: nội dung trái, BXH các team ở cột phải.
 *
 * Cột phải nằm TRONG Shell nên nó có mặt ở cả ba trạng thái — kể cả lúc lỗi hay
 * lúc chưa thuộc team nào. Đặt riêng ở nhánh "có team" thì layout nhảy một nhịp
 * khi dữ liệu về, và người chưa có team thì không xem được bảng nào cả dù bảng đó
 * chẳng cần team để đọc.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-full lg:grid-cols-[minmax(0,1fr)_420px]">
      <main className="min-w-0 overflow-y-auto">
        <PageContainer>{children}</PageContainer>
      </main>
      <SideColumn className="min-w-0 overflow-y-auto">
        <SidePanel label="BXH các team" flush>
          <TeamStandings />
        </SidePanel>
      </SideColumn>
    </div>
  )
}
