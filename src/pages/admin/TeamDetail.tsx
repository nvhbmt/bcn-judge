/**
 * Thao tác trên một team (FR-J1): thêm/gỡ thành viên, đổi leader, xoá team.
 *
 * ⚠ API hiện KHÔNG có `GET /api/admin/teams/:id/members` — route admin chỉ trả
 * `memberCount`, còn `/api/member/teams/mine` chỉ phục vụ team của chính người
 * gọi. Nên phần dưới không liệt kê được danh sách thành viên; mọi thao tác đi
 * qua ô tìm tài khoản. Gỡ nhầm người không thuộc team là lệnh rỗng, không hỏng
 * dữ liệu. Khi server bổ sung route liệt kê thì thay ô "gỡ" bằng danh sách thật.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Crown, Trash2, UserMinus, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui'
import { api } from '@/lib/api'
import { describeFailure, type FailureNotice } from './conflicts'
import type { AdminTeam } from './types'
import { FailureBanner, SuccessNote } from './ui'
import { UserPicker } from './UserPicker'
import { cn } from '@/lib/cn'

type Op = 'add' | 'remove' | 'leader'

const OP_LABEL: Record<Op, { title: string; action: string; hint: string }> = {
  add: {
    title: 'Thêm thành viên',
    action: 'Thêm',
    hint: 'Mỗi member chỉ thuộc tối đa một team — người đang ở team khác sẽ bị từ chối.',
  },
  remove: {
    title: 'Gỡ thành viên',
    action: 'Gỡ',
    hint: 'Gỡ thành viên không xoá bài nộp hay tiến độ. Không gỡ được leader đương nhiệm.',
  },
  leader: {
    title: 'Đổi leader',
    action: 'Đặt làm leader',
    hint: 'Leader mới phải đã là thành viên của team này — thêm vào team trước nếu chưa.',
  },
}

export function TeamDetail({ team }: { team: AdminTeam }) {
  const client = useQueryClient()
  const [op, setOp] = useState<Op>('add')
  const [notice, setNotice] = useState<FailureNotice | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const refresh = () => client.invalidateQueries({ queryKey: ['admin', 'teams'] })

  function settle(message: string) {
    setNotice(null)
    setDone(message)
    void refresh()
  }

  const run = useMutation({
    mutationFn: ({ kind, userId }: { kind: Op; userId: string }) => {
      if (kind === 'add') return api.post(`/api/admin/teams/${team.id}/members`, { userId })
      if (kind === 'remove') return api.del(`/api/admin/teams/${team.id}/members/${userId}`)
      return api.put(`/api/admin/teams/${team.id}/leader`, { userId })
    },
    onSuccess: (_data, vars) => settle(SUCCESS[vars.kind]),
    onError: (err) => {
      setDone(null)
      setNotice(describeFailure(err, 'Thao tác trên team không thành công.'))
    },
  })

  const removeTeam = useMutation({
    mutationFn: () => api.del(`/api/admin/teams/${team.id}`),
    onSuccess: () => {
      setNotice(null)
      void refresh()
    },
    onError: (err) => setNotice(describeFailure(err, 'Không xoá được team.')),
  })

  return (
    <div className="border-t border-line p-3">
      <FailureBanner notice={notice} />
      <SuccessNote>{done}</SuccessNote>

      <p className="mb-3 text-sm text-ink-5">
        <Crown size={13} className="mr-1 inline text-tle" />
        Leader hiện tại: <strong className="font-medium text-ink-2">{team.leaderName}</strong> ·{' '}
        {team.memberCount} thành viên.
      </p>

      {/* Nhóm nút bật/tắt, KHÔNG phải tab: không có tabpanel nào ở đây, nên
          `aria-pressed` mới là ngữ nghĩa đúng cho trình đọc màn hình. */}
      <div role="group" aria-label="Thao tác team" className="mb-2 flex flex-wrap gap-1.5">
        {(Object.keys(OP_LABEL) as Op[]).map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={op === kind}
            onClick={() => {
              setOp(kind)
              setDone(null)
              setNotice(null)
            }}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
              op === kind ? 'bg-primary text-on-accent' : 'border border-line-strong hover:bg-surface-sel',
            )}
          >
            {kind === 'add' ? <UserPlus size={13} /> : kind === 'remove' ? <UserMinus size={13} /> : <Crown size={13} />}
            {OP_LABEL[kind].title}
          </button>
        ))}
      </div>

      <p className="mb-1.5 text-xs text-ink-5">{OP_LABEL[op].hint}</p>
      <UserPicker
        role="member"
        actionLabel={OP_LABEL[op].action}
        pending={run.isPending}
        onPick={(user) => run.mutate({ kind: op, userId: user.id })}
      />

      <div className="mt-4 border-t border-line pt-3">
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-wa">
              Xoá team “{team.name}”? Bài nộp và tiến độ của thành viên giữ nguyên.
            </span>
            <Button variant="danger" onClick={() => removeTeam.mutate()} disabled={removeTeam.isPending}>
              {removeTeam.isPending ? 'Đang xoá…' : 'Xác nhận xoá'}
            </Button>
            <Button onClick={() => setConfirmDelete(false)}>Không xoá</Button>
          </div>
        ) : (
          <Button onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} /> Xoá team
          </Button>
        )}
      </div>
    </div>
  )
}

const SUCCESS: Record<Op, string> = {
  add: 'Đã thêm vào team.',
  remove: 'Đã gỡ khỏi team.',
  leader: 'Đã đổi leader.',
}
