/**
 * `/quan-tri/cai-dat/ngon-ngu/:languageId` — sửa cấu hình một ngôn ngữ chấm.
 *
 * Không có trang "tạo": ngôn ngữ do seed dựng và `PUT /api/admin/languages/:id` chỉ
 * sửa được cái đã có. Thêm ngôn ngữ mới cần build image runner nên nó là việc triển
 * khai, không phải việc bấm nút.
 */
import { useNavigate, useParams } from 'react-router-dom'
import { EmptyState, Spinner } from '@/components/ui'
import { AdminShell } from './AdminShell'
import { LanguageForm } from './LanguageForm'
import { useAdminLanguage } from './useAdminLists'

const BACK = { to: '/quan-tri/cai-dat', label: 'Cài đặt hệ thống' }

export function AdminLanguageEditPage() {
  const { languageId = '' } = useParams()
  const navigate = useNavigate()
  const { found, isError } = useAdminLanguage(languageId)

  if (found === undefined && !isError) {
    return (
      <AdminShell back={BACK} title="Ngôn ngữ chấm">
        <Spinner />
      </AdminShell>
    )
  }
  if (!found) {
    return (
      <AdminShell back={BACK} title="Ngôn ngữ chấm">
        <EmptyState title="Không tìm thấy ngôn ngữ" hint="Mã ngôn ngữ có thể đã đổi." />
      </AdminShell>
    )
  }

  return (
    <AdminShell back={BACK} title={found.name} description={`${found.id} · ${found.image}`}>
      <LanguageForm lang={found} onDone={() => navigate(BACK.to)} />
    </AdminShell>
  )
}
