/** FR-H1/H2 — trang cài đặt: giới hạn mặc định toàn hệ thống và cấu hình ngôn ngữ chấm. */
import { useQuery } from '@tanstack/react-query'
import { EmptyState, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { AdminShell } from './AdminShell'
import { LanguagesPanel } from './LanguagesPanel'
import { SettingsForm } from './SettingsForm'
import type { SettingsMap } from './types'

export function AdminSettingsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get<SettingsMap>('/api/admin/settings'),
  })

  return (
    <AdminShell
      title="Cài đặt hệ thống"
      description="Mọi giới hạn đều đổi được lúc chạy và có hiệu lực sau vài giây (server cache 5 giây)."
    >
      <LanguagesPanel />

      {isLoading ? <Spinner /> : null}
      {isError ? <EmptyState title="Không đọc được cài đặt" hint="Thử tải lại trang." /> : null}
      {data ? <SettingsForm settings={data} /> : null}
    </AdminShell>
  )
}
