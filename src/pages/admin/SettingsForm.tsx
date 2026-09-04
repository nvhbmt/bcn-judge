/**
 * Form giới hạn hệ thống (FR-H2).
 *
 * `PATCH /settings` nhận object MỘT PHẦN và bỏ qua khoá lạ, nên chỉ gửi đúng
 * những ô admin đã sửa. Gửi cả object là ghi đè cả những khoá admin khác vừa
 * đổi trong lúc trang này còn mở.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui'
import { api } from '@/lib/api'
import { describeFailure, type FailureNotice } from './conflicts'
import { groupSettings, humanBytes, metaFor } from './settingsMeta'
import type { SettingsMap } from './types'
import { FailureBanner, SuccessNote, TextInput } from './ui'

export function SettingsForm({ settings }: { settings: SettingsMap }) {
  const client = useQueryClient()
  // Chỉ giữ ô đã sửa; ô chưa chạm không có mặt ở đây và không được gửi đi.
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

  const dirtyKeys = Object.keys(draft)
  const valueOf = (key: string) => draft[key] ?? settings[key]

  return (
    <div>
      <FailureBanner notice={notice} />
      <SuccessNote>{saved}</SuccessNote>

      {groupSettings(settings).map((group) => (
        <section key={group.title} className="mb-5 border border-line bg-surface-2 p-4">
          <h2 className="mb-3 font-mono text-[11px] tracking-[0.14em] text-[var(--label)] uppercase">{group.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.keys.map((key) => {
              const meta = metaFor(key)
              const value = valueOf(key)
              const dirty = key in draft
              // Ô đã sửa: nền đậm một bậc CỘNG vạch trái 2px, đúng lối `Row accent` của
              // hệ thiết kế. Trước đây chỉ có mỗi nền, lại còn phủ 40% — ở nền tối nó
              // chênh với surface-2 chừng 3/255, tức là không thấy gì. Mà đây đúng là
              // thứ trả lời "tôi vừa đổi những ô nào" trước khi bấm Lưu.
              return (
                <div
                  key={key}
                  className={dirty ? '-m-2 border-l-2 border-l-moss bg-surface-sel p-2 pl-3' : ''}
                >
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink-3">
                      {meta.label}
                      {meta.unit ? <span className="font-normal text-ink-5"> ({meta.unit})</span> : null}
                    </span>
                    {typeof value === 'boolean' ? (
                      <span className="flex items-center gap-2 py-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })}
                          className="size-4"
                        />
                        {value ? 'Đang bật' : 'Đang tắt'}
                      </span>
                    ) : (
                      <TextInput
                        type="number"
                        inputMode="numeric"
                        value={String(value ?? '')}
                        onChange={(e) => {
                          const next = Number(e.target.value)
                          // Ô trống hoặc chữ → bỏ khỏi bản nháp, giữ giá trị đang chạy.
                          if (e.target.value === '' || Number.isNaN(next)) {
                            const { [key]: _drop, ...rest } = draft
                            return setDraft(rest)
                          }
                          setDraft({ ...draft, [key]: next })
                        }}
                        className="font-mono tabular-nums"
                      />
                    )}
                  </label>
                  <span className="mt-1 block text-xs text-ink-5">
                    {meta.bytes && typeof value === 'number' ? `${humanBytes(value)}. ` : null}
                    {meta.hint}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-ink-6">{key}</span>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {/* Thanh hành động dính đáy. Nền phải LẤY TỪ TOKEN và phải đục: nội dung cuộn
          chui xuống dưới nó, nên một màu cứng ở đây vừa không đổi theo theme vừa là
          thứ duy nhất còn sót lại của thang xám lạnh cũ — ở nền tối nó thành một vạch
          sáng trắng nằm vắt ngang trang. Dùng --surface-1 vì nền trang là --surface-0
          còn các khối là --surface-2: đây là bậc duy nhất tách khỏi cả hai. */}
      <div className="sticky bottom-0 -mx-4 border-t border-line bg-surface-1 px-4 py-3">
        <Button variant="primary" onClick={() => save.mutate(draft)} disabled={save.isPending || dirtyKeys.length === 0}>
          {save.isPending ? 'Đang lưu…' : dirtyKeys.length === 0 ? 'Chưa có thay đổi' : `Lưu ${dirtyKeys.length} thay đổi`}
        </Button>
        {dirtyKeys.length > 0 ? (
          <Button onClick={() => setDraft({})} className="ml-2">
            Hoàn tác
          </Button>
        ) : null}
      </div>
    </div>
  )
}
