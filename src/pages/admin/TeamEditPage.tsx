/**
 * `/quan-tri/team/moi` và `/quan-tri/team/:teamId` — tạo team và xếp thành viên.
 *
 * Cùng lý do với trang khoá: danh sách chỉ để nhìn và điều hướng, mọi thao tác sửa có
 * URL riêng — chia sẻ được, tải lại không mất chỗ.
 */
import { useNavigate, useParams } from 'react-router-dom'
import { EmptyState, Spinner } from '@/components/ui'
import { AdminShell } from './AdminShell'
import { TeamCreateForm } from './TeamCreateForm'
import { TeamDetail } from './TeamDetail'
import { TeamRenameForm } from './TeamRenameForm'
import { useAdminTeam } from './useAdminLists'

const BACK = { to: '/quan-tri/team', label: 'Danh sách team' }

export function AdminTeamCreatePage() {
  const navigate = useNavigate()
  return (
    <AdminShell
      back={BACK}
      title="Tạo team"
      description="Leader phải là một member, và sẽ tự thành thành viên của chính team vừa tạo."
    >
      <TeamCreateForm onDone={() => navigate(BACK.to)} />
    </AdminShell>
  )
}

export function AdminTeamEditPage() {
  const { teamId = '' } = useParams()
  const { found, isError } = useAdminTeam(teamId)

  if (found === undefined && !isError) {
    return (
      <AdminShell back={BACK} title="Team">
        <Spinner />
      </AdminShell>
    )
  }
  if (!found) {
    return (
      <AdminShell back={BACK} title="Team">
        <EmptyState title="Không tìm thấy team" hint="Team có thể đã bị xoá." />
      </AdminShell>
    )
  }

  return (
    <AdminShell back={BACK} title={found.name} description={`Leader: ${found.leaderName}`}>
      {/* Đổi tên đứng TRƯỚC phần xếp người: đó là thao tác không cần chọn ai, còn phần
          dưới thì lượt nào cũng phải tìm một tài khoản. */}
      <TeamRenameForm team={found} />
      <TeamDetail team={found} />
    </AdminShell>
  )
}
