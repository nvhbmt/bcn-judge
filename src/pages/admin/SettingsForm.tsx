/**
 * Cột TRÁI của trang cài đặt (FR-H2): các giới hạn hệ thống, gom theo nhóm.
 *
 * Form không còn tự vẽ nút Lưu: nút đứng ở hàng tiêu đề cùng `AdminShell`, và bản
 * nháp sống ở `useSettingsDraft` phía trên cả hai. Ở đây chỉ còn băng lỗi, các nhóm
 * dòng, và băng "chưa lưu" bám đáy — thứ chỉ hiện khi thật sự có thay đổi.
 */
import { SectionRule } from '@/components/ui'
import { RowGroup } from '@/components/ui/patterns'
import { UnsavedBar } from './SettingsActions'
import { SettingsRow } from './SettingsRow'
import { groupSettings } from './settingsMeta'
import type { SettingsMap } from './types'
import type { SettingsDraft } from './useSettingsDraft'
import { FailureBanner, SuccessNote } from './ui'

export function SettingsForm({ settings, draft }: { settings: SettingsMap; draft: SettingsDraft }) {
  return (
    <div>
      <FailureBanner notice={draft.notice} />
      <SuccessNote>{draft.saved}</SuccessNote>

      {groupSettings(settings).map((group) => (
        <section key={group.title} className="mb-6">
          <div className="mb-2.5">
            <SectionRule label={group.title} />
          </div>
          <RowGroup>
            {group.keys.map((key) => (
              <SettingsRow
                key={key}
                settingKey={key}
                value={draft.draft[key] ?? settings[key]!}
                draft={draft}
              />
            ))}
          </RowGroup>
        </section>
      ))}

      <UnsavedBar draft={draft} />
    </div>
  )
}
