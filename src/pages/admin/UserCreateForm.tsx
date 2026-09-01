/** FR-A2: tạo một tài khoản. Không có đăng ký tự do — mọi tài khoản do admin cấp. */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui'
import { api } from '@/lib/api'
import type { Role } from '@/types/api'
import { describeFailure, type FailureNotice } from './conflicts'
import type { OneTimeSecretData } from './OneTimeSecret'
import type { UserWithSecret } from './types'
import { Field, FailureBanner, Select, TextInput } from './ui'

const EMPTY = { email: '', displayName: '', role: 'member' as Role, username: '', password: '' }

export function UserCreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (secret: OneTimeSecretData) => void
  onCancel: () => void
}) {
  const client = useQueryClient()
  const [form, setForm] = useState(EMPTY)
  const [notice, setNotice] = useState<FailureNotice | null>(null)

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<UserWithSecret>('/api/admin/users', body),
    onSuccess: (row) => {
      setForm(EMPTY)
      setNotice(null)
      void client.invalidateQueries({ queryKey: ['admin', 'users'] })
      onCreated({ email: row.email, password: row.initialPassword, kind: 'created' })
    },
    onError: (err) => setNotice(describeFailure(err, 'Không tạo được tài khoản.')),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    // Trường tuỳ chọn phải BỎ HẲN khi trống: server dùng zod `.optional()` với
    // min(3)/min(8), chuỗi rỗng gửi lên là 400 chứ không phải "không đặt".
    create.mutate({
      email: form.email.trim(),
      displayName: form.displayName.trim(),
      role: form.role,
      ...(form.username.trim() ? { username: form.username.trim() } : {}),
      ...(form.password ? { password: form.password } : {}),
    })
  }

  return (
    <form onSubmit={submit} className="border border-line bg-surface-2 p-4">
      <h2 className="mb-3 text-sm font-semibold">Tạo tài khoản</h2>
      <FailureBanner notice={notice} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email">
          <TextInput
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="off"
          />
        </Field>
        <Field label="Họ và tên">
          <TextInput
            required
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </Field>
        <Field label="Vai trò">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="member">Member</option>
            <option value="mentor">Mentor</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        <Field label="Tên đăng nhập (tuỳ chọn)" hint="Ít nhất 3 ký tự; bỏ trống thì đăng nhập bằng email.">
          <TextInput
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            autoComplete="off"
          />
        </Field>
        <Field
          label="Mật khẩu ban đầu (tuỳ chọn)"
          hint="Bỏ trống để hệ thống sinh ngẫu nhiên. Dù đặt hay sinh, người dùng đều phải đổi ở lần đăng nhập đầu."
        >
          <TextInput
            type="text"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete="off"
          />
        </Field>
      </div>

      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="primary" disabled={create.isPending}>
          {create.isPending ? 'Đang tạo…' : 'Tạo tài khoản'}
        </Button>
        <Button type="button" onClick={onCancel}>
          Huỷ
        </Button>
      </div>
    </form>
  )
}
