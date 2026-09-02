/** FR-J1 — trang team: tạo, xếp thành viên, đổi leader, xoá. Team thuộc toàn CLB, không theo khoá. */
import { Crown, Pencil, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, Spinner, buttonClass } from '@/components/ui'
import { AdminShell } from './AdminShell'
import { useAdminTeams } from './useAdminLists'

export function AdminTeamsPage() {
  const { data, isLoading } = useAdminTeams()

  return (
    <AdminShell
      title="Team"
      description="Mỗi member thuộc tối đa một team, và leader luôn phải là thành viên của chính team đó — hai ràng buộc này do database giữ, nên vi phạm sẽ bị chặn kèm hướng xử lý."
    >
      <div className="mb-4">
        <Link to="/quan-tri/team/moi" className={buttonClass('primary')}>
          <Plus size={15} /> Tạo team
        </Link>
      </div>

      {isLoading ? <Spinner /> : null}
      {data && data.length === 0 ? (
        <EmptyState title="Chưa có team nào" hint="Tạo team đầu tiên và chọn một member làm leader." />
      ) : null}

      <ul className="space-y-2">
        {data?.map((team) => (
          <li key={team.id} className="flex flex-wrap items-center gap-2 border border-line bg-surface-2 p-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{team.name}</span>
              <span className="flex items-center gap-1 text-xs text-ink-5">
                <Crown size={12} className="text-[var(--color-tle)]" />
                {team.leaderName}
              </span>
            </span>
            <span className="text-xs whitespace-nowrap text-ink-5">{team.memberCount} thành viên</span>
            <Link to={`/quan-tri/team/${team.id}`} className={buttonClass('ghost', 'sm')}>
              <Pencil size={14} /> Sửa
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  )
}
