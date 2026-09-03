/**
 * Tạo team (FR-J1). Leader chọn ngay lúc tạo vì server dựng team và dòng thành
 * viên của leader trong CÙNG một transaction (FK deferrable) — không có trạng
 * thái "team chưa có leader" để sửa sau.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button, SectionRule } from '@/components/ui'
import { api } from '@/lib/api'
import { describeFailure, type FailureNotice } from './conflicts'
import type { PickableUser } from './UserPicker'
import { Field, FailureBanner, TextArea, TextInput } from './ui'
import { UserPicker } from './UserPicker'

export function TeamCreateForm({ onDone }: { onDone: () => void }) {
  const client = useQueryClient()
  const [name, setName] = useState('')
  const [descriptionMd, setDescriptionMd] = useState('')
  const [leader, setLeader] = useState<PickableUser | null>(null)
  const [notice, setNotice] = useState<FailureNotice | null>(null)

  const create = useMutation({
    mutationFn: (body: { name: string; descriptionMd?: string; leaderId: string }) =>
      api.post<{ id: string }>('/api/admin/teams', body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin', 'teams'] })
      onDone()
    },
    onError: (err) => setNotice(describeFailure(err, 'Không tạo được team.')),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!leader) return setNotice({ message: 'Chưa chọn leader.', nextStep: 'Tìm và chọn một tài khoản Member.' })
    create.mutate({
      name: name.trim(),
      leaderId: leader.id,
      ...(descriptionMd.trim() ? { descriptionMd } : {}),
    })
  }

  return (
    <form onSubmit={submit} className="mb-5 border border-line bg-surface-2 p-4">
      <div className="mb-3"><SectionRule label="Tạo team" /></div>
      <FailureBanner notice={notice} />

      <div className="grid gap-3">
        <Field label="Tên team">
          <TextInput required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Mô tả (Markdown, tuỳ chọn)">
          <TextArea rows={3} value={descriptionMd} onChange={(e) => setDescriptionMd(e.target.value)} />
        </Field>
        <Field
          label="Leader"
          hint="Chỉ tài khoản vai trò Member; người này thành thành viên đầu tiên của team và không được ở team khác."
        >
          <div>
            {leader ? (
              <p className="mb-2 flex items-center gap-2 text-sm">
                Đã chọn: <strong className="font-medium">{leader.displayName}</strong>
                <span className="font-mono text-xs text-ink-5">{leader.email}</span>
                <Button type="button" onClick={() => setLeader(null)} className="ml-auto">
                  Chọn lại
                </Button>
              </p>
            ) : (
              <UserPicker role="member" actionLabel="Chọn làm leader" onPick={setLeader} />
            )}
          </div>
        </Field>
      </div>

      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="primary" disabled={create.isPending || !leader}>
          {create.isPending ? 'Đang tạo…' : 'Tạo team'}
        </Button>
        <Button type="button" onClick={onDone}>
          Huỷ
        </Button>
      </div>
    </form>
  )
}
