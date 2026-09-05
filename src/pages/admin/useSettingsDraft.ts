/**
 * Bản nháp của trang cài đặt (FR-H2), tách khỏi form.
 *
 * Vì sao không để state nằm trong `SettingsForm` như trước: nút LƯU nay đứng ở hàng
 * tiêu đề — chỗ `AdminShell` vẽ mọi hành động cấp trang — nên nó nằm NGOÀI form trong
 * cây React. Hai chỗ cùng đọc-ghi một bản nháp thì bản nháp phải ở trên cả hai.
 *
 * `PATCH /settings` nhận object MỘT PHẦN và bỏ qua khoá lạ, nên chỉ giữ đúng những ô
 * admin đã sửa. Gửi cả object là ghi đè luôn những khoá mà admin khác vừa đổi trong
 * lúc trang này còn mở.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { describeFailure, type FailureNotice } from './conflicts'
import type { SettingsMap } from './types'

export interface SettingsDraft {
  /** Chỉ chứa ô đã sửa; ô chưa chạm không có mặt và không được gửi đi. */
  draft: SettingsMap
  dirtyKeys: string[]
  notice: FailureNotice | null
  saved: string | null
  saving: boolean
  set: (key: string, value: SettingsMap[string]) => void
  /** Bỏ một ô khỏi bản nháp — dùng khi admin xoá trắng ô số. */
  drop: (key: string) => void
  reset: () => void
  submit: () => void
}

export function useSettingsDraft(): SettingsDraft {
  const client = useQueryClient()
  const [draft, setDraft] = useState<SettingsMap>({})
  const [notice, setNotice] = useState<FailureNotice | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (patch: SettingsMap) => api.patch<{ applied: string[] }>('/api/admin/settings', patch),
    onSuccess: (res) => {
      setNotice(null)
      setDraft({})
      setSaved(`Đã lưu ${res.applied.length} mục.`)
      void client.invalidateQueries({ queryKey: ['admin', 'settings'] })
    },
    onError: (err) => {
      setSaved(null)
      setNotice(describeFailure(err, 'Không lưu được cài đặt.'))
    },
  })

  return {
    draft,
    dirtyKeys: Object.keys(draft),
    notice,
    saved,
    saving: save.isPending,
    set: (key, value) => setDraft((cu) => ({ ...cu, [key]: value })),
    drop: (key) =>
      setDraft(({ [key]: _bo, ...con }) => con),
    reset: () => setDraft({}),
    submit: () => save.mutate(draft),
  }
}
