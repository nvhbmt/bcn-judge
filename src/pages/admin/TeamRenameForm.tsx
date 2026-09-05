/**
 * Đổi tên và mô tả team (FR-J1 — "tạo / SỬA / xoá team").
 *
 * Trước đây cụm quản trị chỉ có TẠO và XOÁ. Một lỗi chính tả trong tên team vì thế
 * phải chữa bằng cách xoá rồi tạo lại, mà xoá team là mất sạch `team_members` và cả
 * leader — tức phải xếp lại người chỉ vì gõ sai một chữ. `descriptionMd` còn tệ hơn:
 * form tạo có ô nhập nó, nhưng không đường nào sửa, nên cột đó ghi được đúng một lần.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui'
import { api } from '@/lib/api'
import { describeFailure, type FailureNotice } from './conflicts'
import type { AdminTeam } from './types'
import { Field, FailureBanner, SuccessNote, TextArea, TextInput } from './ui'

export function TeamRenameForm({ team }: { team: AdminTeam }) {
  const client = useQueryClient()
  const [name, setName] = useState(team.name)
  const [descriptionMd, setDescriptionMd] = useState(team.descriptionMd ?? '')
  const [notice, setNotice] = useState<FailureNotice | null>(null)
  const [done, setDone] = useState(false)

  // So với dữ liệu SERVER chứ không giữ cờ "đã gõ": gõ rồi xoá về như cũ thì nút phải
  // tắt lại, còn cờ thì kẹt ở trạng thái bật và mời gửi một lượt sửa rỗng.
  const doi = name.trim() !== team.name || descriptionMd.trim() !== (team.descriptionMd ?? '')

  const luu = useMutation({
    mutationFn: () =>
      api.patch(`/api/admin/teams/${team.id}`, { name: name.trim(), descriptionMd: descriptionMd.trim() }),
    onSuccess: () => {
      setNotice(null)
      setDone(true)
      void client.invalidateQueries({ queryKey: ['admin', 'teams'] })
    },
    onError: (err) => {
      setDone(false)
      setNotice(describeFailure(err, 'Không lưu được thay đổi.'))
    },
  })

  return (
    <form
      className="border-t border-line p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (doi && name.trim()) luu.mutate()
      }}
    >
      <FailureBanner notice={notice} />
      <SuccessNote>{done ? 'Đã lưu.' : null}</SuccessNote>

      <Field label="Tên team">
        <TextInput
          value={name}
          maxLength={120}
          required
          onChange={(e) => {
            setName(e.target.value)
            setDone(false)
          }}
        />
      </Field>
      <Field label="Mô tả" hint="Markdown. Để trống thì team không có mô tả.">
        <TextArea
          rows={3}
          value={descriptionMd}
          onChange={(e) => {
            setDescriptionMd(e.target.value)
            setDone(false)
          }}
        />
      </Field>

      <Button type="submit" variant="primary" disabled={!doi || !name.trim() || luu.isPending}>
        {luu.isPending ? 'Đang lưu…' : 'Lưu'}
      </Button>
    </form>
  )
}
