/** FR-J1 — trang team: tạo, xếp thành viên, đổi leader, xoá. Team thuộc toàn CLB, không theo khoá. */
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Crown, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button, EmptyState, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { AdminShell } from './AdminShell'
import { TeamCreateForm } from './TeamCreateForm'
import { TeamDetail } from './TeamDetail'
import type { AdminTeam } from './types'

export function AdminTeamsPage() {
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: () => api.get<AdminTeam[]>('/api/admin/teams'),
  })

  return (
    <AdminShell
      title="Team"
      description="Mỗi member thuộc tối đa một team, và leader luôn phải là thành viên của chính team đó — hai ràng buộc này do database giữ, nên vi phạm sẽ bị chặn kèm hướng xử lý."
    >
      <div className="mb-4">
        <Button variant="primary" onClick={() => setCreating(!creating)}>
          <Plus size={15} /> Tạo team
        </Button>
      </div>

      {creating ? <TeamCreateForm onDone={() => setCreating(false)} /> : null}

      {isLoading ? <Spinner /> : null}
      {data && data.length === 0 ? (
        <EmptyState title="Chưa có team nào" hint="Tạo team đầu tiên và chọn một member làm leader." />
      ) : null}

      <ul className="space-y-2">
        {data?.map((team) => {
          const open = openId === team.id
          return (
            <li key={team.id} className="border border-line bg-surface-2">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : team.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 p-3 text-left focus-visible:outline-2
 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              >
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{team.name}</span>
                  <span className="flex items-center gap-1 text-xs text-ink-5">
                    <Crown size={12} className="text-[var(--color-tle)]" />
                    {team.leaderName}
                  </span>
                </span>
                <span className="ml-auto text-xs whitespace-nowrap text-ink-5">
                  {team.memberCount} thành viên
                </span>
              </button>

              {open ? <TeamDetail team={team} /> : null}
            </li>
          )
        })}
      </ul>
    </AdminShell>
  )
}
