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
          <li key={team.id} className="border border-line bg-surface-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
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
            </div>

            {/* Tên từng người, ngay ở danh sách. Trước đây chỉ có con số "6 thành
                viên", nên câu hỏi thường gặp nhất của admin — "ai đang ở team nào" —
                phải mở lần lượt từng team mới trả lời được. Dữ liệu về sẵn trong
                cùng lượt gọi, không thêm request nào. */}
            {team.members.length > 0 ? (
              <ul className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
                {team.members.map((m) => (
                  <li
                    key={m.id}
                    className={`inline-flex items-center gap-1 border px-2 py-0.5 text-xs ${
                      m.isLeader ? 'border-brass text-ink-2' : 'border-line text-ink-4'
                    }`}
                  >
                    {m.isLeader ? <Crown size={10} className="text-[var(--color-tle)]" /> : null}
                    {m.displayName}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2.5 border-t border-line pt-2.5 text-xs text-earth">
                Chưa có thành viên nào ngoài leader.
              </p>
            )}
          </li>
        ))}
      </ul>
    </AdminShell>
  )
}
