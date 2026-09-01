/** FR-A2/A3/A4 — trang quản lý tài khoản: tạo, nhập CSV, đặt lại mật khẩu, khoá/mở, đổi vai trò. */
import { useQuery } from '@tanstack/react-query'
import { Search, Upload, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Button, EmptyState, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import type { Role } from '@/types/api'
import { AdminShell } from './AdminShell'
import { OneTimeSecret, type OneTimeSecretData } from './OneTimeSecret'
import type { AdminUser } from './types'
import { Select, TextInput } from './ui'
import { UserCreateForm } from './UserCreateForm'
import { UserImportPanel } from './UserImportPanel'
import { UserRow } from './UserRow'

type Panel = 'none' | 'create' | 'import'

export function AdminUsersPage() {
  const [q, setQ] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [panel, setPanel] = useState<Panel>('none')
  const [secret, setSecret] = useState<OneTimeSecretData | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', 'list', q, role],
    queryFn: () =>
      api.get<AdminUser[]>(`/api/admin/users?q=${encodeURIComponent(q)}${role ? `&role=${role}` : ''}`),
  })

  return (
    <AdminShell
      title="Tài khoản"
      description="Không có đăng ký tự do: mọi tài khoản do admin cấp và bị bắt đổi mật khẩu ở lần đăng nhập đầu."
    >
      {/* Mật khẩu một lần đặt trên cùng và tồn tại qua mọi thao tác khác cho tới
          khi admin tự đóng — không component con nào được phép nuốt nó. */}
      {secret ? <OneTimeSecret data={secret} onDismiss={() => setSecret(null)} /> : null}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="relative min-w-56 flex-1">
          <Search size={14} className="pointer-events-none absolute top-2.5 left-2.5 text-slate-400" />
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo email hoặc họ tên…"
            aria-label="Tìm tài khoản"
            className="pl-8"
          />
        </div>
        <Select
          value={role}
          onChange={(e) => setRole(e.target.value as Role | '')}
          aria-label="Lọc theo vai trò"
          className="w-40"
        >
          <option value="">Mọi vai trò</option>
          <option value="member">Member</option>
          <option value="mentor">Mentor</option>
          <option value="admin">Admin</option>
        </Select>
        <Button variant="primary" onClick={() => setPanel(panel === 'create' ? 'none' : 'create')}>
          <UserPlus size={15} /> Tạo tài khoản
        </Button>
        <Button onClick={() => setPanel(panel === 'import' ? 'none' : 'import')}>
          <Upload size={15} /> Nhập CSV
        </Button>
      </div>

      {panel === 'create' ? (
        <div className="mb-5">
          <UserCreateForm
            onCreated={(s) => {
              setSecret(s)
              setPanel('none')
            }}
            onCancel={() => setPanel('none')}
          />
        </div>
      ) : null}

      {panel === 'import' ? (
        <div className="mb-5">
          <UserImportPanel onClose={() => setPanel('none')} />
        </div>
      ) : null}

      {isLoading ? <Spinner /> : null}

      {data && data.length === 0 ? (
        <EmptyState
          title="Không có tài khoản nào khớp bộ lọc"
          hint={q || role ? 'Xoá từ khoá hoặc chọn “Mọi vai trò”.' : 'Tạo tài khoản đầu tiên bằng nút phía trên.'}
        />
      ) : null}

      {data && data.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full text-sm">
            <caption className="sr-only">Danh sách tài khoản</caption>
            <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-800">
              <tr>
                <th scope="col" className="px-2 py-2">Tài khoản</th>
                <th scope="col" className="px-2 py-2">Vai trò</th>
                <th scope="col" className="px-2 py-2">Trạng thái</th>
                <th scope="col" className="px-2 py-2">Đăng nhập gần nhất</th>
                <th scope="col" className="px-2 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.map((user) => (
                <UserRow key={user.id} user={user} onSecret={setSecret} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {data && data.length >= 500 ? (
        <p className="mt-2 text-xs text-slate-500">
          Chỉ hiện 500 tài khoản đầu — thu hẹp bằng ô tìm kiếm để thấy phần còn lại.
        </p>
      ) : null}
    </AdminShell>
  )
}
