/**
 * Một dòng tài khoản với đủ thao tác tại chỗ (FR-A3/A4).
 *
 * Mỗi dòng tự giữ mutation và tự hiện lỗi của mình. Vì sao không gom lỗi lên
 * đầu bảng: 409 `cannot_demote_self` chỉ có nghĩa khi đứng cạnh đúng tài khoản
 * gây ra nó — một băng lỗi ở đầu danh sách 500 dòng thì admin không biết dòng nào.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock, LockOpen, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/lib/api'
import type { Role } from '@/types/api'
import { describeFailure, type FailureNotice } from './conflicts'
import type { OneTimeSecretData } from './OneTimeSecret'
import type { AdminUser, UserWithSecret } from './types'
import { FailureBanner, Select } from './ui'

const ACTION_BTN =
  'inline-flex items-center gap-1  border border-line-strong px-2 py-1 text-xs hover:bg-surface-sel ' +
  'disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-1 ' +
  'focus-visible:outline-[var(--color-primary)]'

export function UserRow({ user, onSecret }: { user: AdminUser; onSecret: (s: OneTimeSecretData) => void }) {
  const client = useQueryClient()
  const [notice, setNotice] = useState<FailureNotice | null>(null)
  const refresh = () => client.invalidateQueries({ queryKey: ['admin', 'users'] })

  const patch = useMutation({
    mutationFn: (body: { role?: Role; disabled?: boolean }) => api.patch(`/api/admin/users/${user.id}`, body),
    onSuccess: () => {
      setNotice(null)
      void refresh()
    },
    onError: (err) => setNotice(describeFailure(err, 'Không cập nhật được tài khoản.')),
  })

  const resetPassword = useMutation({
    mutationFn: () => api.post<UserWithSecret>(`/api/admin/users/${user.id}/reset-password`, {}),
    onSuccess: (row) => {
      setNotice(null)
      void refresh()
      onSecret({ email: row.email, password: row.initialPassword, kind: 'reset' })
    },
    onError: (err) => setNotice(describeFailure(err, 'Không đặt lại được mật khẩu.')),
  })

  const busy = patch.isPending || resetPassword.isPending

  return (
    <>
      <tr className={`border-t border-line ${user.disabled ? 'opacity-60' : ''}`}>
        <td className="px-2 py-2">
          <span className="block">{user.displayName}</span>
          <span className="block font-mono text-xs break-all text-ink-5">{user.email}</span>
        </td>
        <td className="px-2 py-2">
          <Select
            aria-label={`Vai trò của ${user.displayName}`}
            value={user.role}
            disabled={busy}
            onChange={(e) => patch.mutate({ role: e.target.value as Role })}
            className="w-28"
          >
            <option value="member">Member</option>
            <option value="mentor">Mentor</option>
            <option value="admin">Admin</option>
          </Select>
        </td>
        <td className="px-2 py-2 text-xs">
          {user.disabled ? (
            <span className="bg-[var(--tint-clay)] px-1.5 py-0.5 font-medium text-clay">
              Đã khoá
            </span>
          ) : (
            <span className="bg-surface-sel px-1.5 py-0.5 font-medium text-moss">
              Hoạt động
            </span>
          )}
          {user.mustChangePassword ? (
            <span className="mt-1 block text-ink-5">Chờ đổi mật khẩu lần đầu</span>
          ) : null}
        </td>
        <td className="px-2 py-2 text-xs whitespace-nowrap text-ink-5">
          {user.lastLogin ? new Date(user.lastLogin).toLocaleString('vi-VN') : 'chưa đăng nhập'}
        </td>
        <td className="px-2 py-2">
          <div className="flex flex-wrap justify-end gap-1.5">
            <button type="button" className={ACTION_BTN} disabled={busy} onClick={() => resetPassword.mutate()}>
              <KeyRound size={13} /> Đặt lại mật khẩu
            </button>
            <button
              type="button"
              className={ACTION_BTN}
              disabled={busy}
              onClick={() => patch.mutate({ disabled: !user.disabled })}
            >
              {user.disabled ? <LockOpen size={13} /> : <Lock size={13} />}
              {user.disabled ? 'Mở khoá' : 'Khoá'}
            </button>
          </div>
        </td>
      </tr>
      {notice ? (
        <tr>
          <td colSpan={5} className="px-2 pb-2">
            <FailureBanner notice={notice} />
          </td>
        </tr>
      ) : null}
    </>
  )
}
