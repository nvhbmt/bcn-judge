/**
 * FR-H1/H2 — trang cài đặt, HAI PHẦN đứng cạnh nhau.
 *
 * Trái là giới hạn hệ thống, phải là ngôn ngữ chấm. Trước đây hai phần xếp dọc nên
 * danh sách ngôn ngữ đẩy toàn bộ giới hạn xuống dưới màn hình đầu, dù đó mới là thứ
 * admin vào đây để sửa. Chúng cũng là hai công việc KHÁC nhau (chỉnh số / bật-tắt
 * ngôn ngữ) và lưu bằng hai API khác nhau — ngôn ngữ lưu ngay khi bấm, giới hạn phải
 * bấm Lưu — nên đặt cạnh nhau thì ranh giới đó nhìn thấy được.
 *
 * Dưới `lg` thì xếp dọc lại, giới hạn trước.
 */
import { useQuery } from '@tanstack/react-query'
import { EmptyState, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { AdminShell } from './AdminShell'
import { LanguagesPanel } from './LanguagesPanel'
import { SettingsSaveButton } from './SettingsActions'
import { SettingsForm } from './SettingsForm'
import type { SettingsMap } from './types'
import { useSettingsDraft } from './useSettingsDraft'

export function AdminSettingsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get<SettingsMap>('/api/admin/settings'),
  })
  const draft = useSettingsDraft()

  return (
    <AdminShell
      title="Cài đặt hệ thống"
      description="Đổi ở đây có hiệu lực sau vài giây (server cache 5 giây), không cần deploy lại."
      actions={data ? <SettingsSaveButton draft={draft} /> : null}
    >
      <div className="grid items-start gap-x-9 gap-y-8 lg:grid-cols-2">
        <div className="min-w-0">
          {isLoading ? <Spinner /> : null}
          {isError ? <EmptyState title="Không đọc được cài đặt" hint="Thử tải lại trang." /> : null}
          {data ? <SettingsForm settings={data} draft={draft} /> : null}
        </div>

        <LanguagesPanel />
      </div>
    </AdminShell>
  )
}
