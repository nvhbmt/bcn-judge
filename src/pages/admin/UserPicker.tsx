/**
 * Chọn một tài khoản bằng cách gõ tìm — dùng cho gán mentor (FR-B2) và xếp
 * team (FR-J1).
 *
 * Không dùng `<select>` liệt kê hết: `GET /users` trả tối đa 500 dòng, và một
 * CLB vài trăm thành viên thì cuộn `<select>` là vô vọng. Lọc phía server bằng
 * tham số `q` (ILIKE trên email và họ tên) nên danh sách luôn ngắn.
 */
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import type { Role } from '@/types/api'
import type { AdminUser } from './types'
import { TextInput } from './ui'

/** Gõ đến đâu gọi API đến đó là phí; 250 ms đủ ngắn để không thấy trễ. */
function useDebounced(value: string, delay = 250): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function UserPicker({
  role,
  actionLabel,
  onPick,
  disabledIds = [],
  pending = false,
}: {
  /** Lọc theo vai trò; bỏ trống là mọi vai trò. */
  role?: Role
  actionLabel: string
  onPick: (user: AdminUser) => void
  /** Người đã ở trong danh sách — vẫn hiện nhưng không bấm được nữa. */
  disabledIds?: string[]
  pending?: boolean
}) {
  const [term, setTerm] = useState('')
  const q = useDebounced(term.trim())

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'users', 'picker', q, role ?? 'all'],
    queryFn: () =>
      api.get<AdminUser[]>(`/api/admin/users?q=${encodeURIComponent(q)}${role ? `&role=${role}` : ''}`),
    // Chỉ tìm khi đã gõ: nạp sẵn 500 tài khoản cho một ô tìm kiếm là lãng phí.
    enabled: q.length > 0,
  })

  const results = (data ?? []).slice(0, 20)
  const blocked = new Set(disabledIds)

  return (
    <div>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute top-2.5 left-2.5 text-ink-6" />
        <TextInput
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={role === 'member' ? 'Tìm member theo email hoặc họ tên…' : 'Tìm theo email hoặc họ tên…'}
          aria-label="Tìm tài khoản"
          className="pl-8"
        />
      </div>

      {q.length === 0 ? null : isFetching && !data ? (
        <div className="py-2">
          <Spinner label="Đang tìm…" />
        </div>
      ) : results.length === 0 ? (
        <p className="py-2 text-sm text-ink-5" role="status">
          Không có tài khoản nào khớp “{q}”
          {role === 'member' ? ' với vai trò Member' : ''}.
        </p>
      ) : (
        <ul className="mt-2 max-h-56 divide-y divide-line overflow-auto border border-line">
          {results.map((user) => (
            <li key={user.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{user.displayName}</span>
                <span className="block truncate font-mono text-xs text-ink-5">{user.email}</span>
              </span>
              <span className="ml-auto shrink-0 text-xs text-ink-6">{ROLE_LABEL[user.role]}</span>
              <button
                type="button"
                disabled={pending || blocked.has(user.id)}
                onClick={() => onPick(user)}
                className="shrink-0 border border-line-strong px-2 py-1 text-xs hover:bg-surface-sel
 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2
 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)]"
              >
                {blocked.has(user.id) ? 'Đã có' : actionLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  mentor: 'Mentor',
  member: 'Member',
}
