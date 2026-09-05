/**
 * `/quan-tri/nhat-ky` — nhật ký hành động quản trị (FR-H4).
 *
 * `GET /api/admin/audit` đã có từ lâu và mọi mutation của cụm quản trị đều gọi
 * `audit(...)`, nhưng KHÔNG màn nào đọc nó. Tức bảng `audit_log` chỉ ghi vào, không
 * ai đọc ra được — đúng nghĩa một cuốn sổ viết rồi khoá tủ. Trang này mở tủ.
 *
 * Không có bộ lọc: server trả 200 dòng gần nhất và câu hỏi thật của người vận hành
 * là "vừa có ai đổi gì" chứ không phải "tìm lại việc tháng trước". Thêm lọc khi nào
 * có người thật sự cần lần lại lịch sử xa.
 */
import { useQuery } from '@tanstack/react-query'
import { EmptyState, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { AdminShell } from './AdminShell'

interface AuditRow {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  after: unknown
  at: string
  actorName: string | null
}

function gio(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(
    d.getHours(),
  ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function AdminAuditPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () => api.get<AuditRow[]>('/api/admin/audit'),
  })

  return (
    <AdminShell
      title="Nhật ký"
      description="200 hành động quản trị gần nhất: ai đổi gì, lúc nào. Chỉ ghi, không sửa được."
    >
      {isLoading ? (
        <div className="p-4">
          <Spinner />
        </div>
      ) : null}

      {data && data.length === 0 ? (
        <EmptyState title="Chưa có hành động nào" hint="Mọi thao tác quản trị sẽ hiện ở đây." />
      ) : null}

      {data && data.length > 0 ? (
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">Nhật ký hành động quản trị</caption>
          {/* Cùng lớp lỗi với hai BXH: bảng không <thead> thì <col> phải nói bề
              rộng, nếu không cột `after` (max-w-0) bóp các cột kia theo nội dung. */}
          <colgroup>
            <col className="w-24" />
            <col className="w-40" />
            <col className="w-56" />
            <col />
          </colgroup>
          <tbody>
            {data.map((r) => (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="num px-2.5 py-2 font-mono text-[13px] whitespace-nowrap text-ink-5">
                  {gio(r.at)}
                </td>
                <td className="px-2.5 py-2 text-[13px] text-ink-2">{r.actorName ?? '—'}</td>
                <td className="px-2.5 py-2 font-mono text-[13px] text-ink-3">
                  {r.action}
                  {r.entityType ? <span className="text-ink-6"> · {r.entityType}</span> : null}
                </td>
                <td className="max-w-0 px-2.5 py-2">
                  {/* `after` là JSON tự do (mỗi hành động ghi một hình dạng khác nhau),
                      nên in thô một dòng chứ không cố dựng bảng cho nó. `truncate` +
                      `title` để dòng dài không phá bố cục mà vẫn đọc đủ khi cần. */}
                  {r.after ? (
                    <span
                      title={JSON.stringify(r.after)}
                      className="block truncate font-mono text-[12px] text-ink-6"
                    >
                      {JSON.stringify(r.after)}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </AdminShell>
  )
}
