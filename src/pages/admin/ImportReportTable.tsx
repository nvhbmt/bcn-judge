/**
 * Kết quả nhập CSV (FR-A2).
 *
 * Bảng này là bản ghi DUY NHẤT của mật khẩu vừa sinh cho cả lô — server chỉ lưu
 * hash. Nên nó phải làm được hai việc trước khi admin rời trang: chép toàn bộ
 * cặp email/mật khẩu ra một lần, và chỉ ra chính xác dòng nào hỏng để sửa rồi
 * nhập lại. Chép từng ô cũng còn đó cho trường hợp gửi riêng một người.
 */
import { CheckCircle2, XCircle } from 'lucide-react'
import type { ImportReport, ImportRow } from './types'
import { CopyButton } from './ui'
import { cn } from '@/lib/cn'

const STATUS_LABEL: Record<string, string> = {
  created: 'Đã tạo',
  invalid: 'Dòng không hợp lệ',
  failed: 'Thất bại',
}

export function ImportReportTable({ report }: { report: ImportReport }) {
  const createdRows = report.results.filter((r) => r.status === 'created')
  const failedRows = report.results.filter((r) => r.status !== 'created')

  // TSV để dán thẳng vào Excel/Google Sheets thành hai cột.
  const credentials = createdRows.map((r) => `${r.email}\t${r.password ?? ''}`).join('\n')
  // Chỉ email của dòng hỏng: dán lại vào ô CSV, sửa, nhập lại lô nhỏ.
  const failedEmails = failedRows.map((r) => r.email).filter(Boolean).join('\n')

  return (
    <div className="mt-4">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-1.5 text-ac">
          <CheckCircle2 size={15} /> {report.created} tài khoản đã tạo
        </span>
        <span className={cn('inline-flex items-center gap-1.5', report.failed > 0 ? 'text-wa' : 'text-ink-5')}>
          <XCircle size={15} /> {report.failed} dòng lỗi
        </span>
        <span className="ml-auto flex gap-2">
          {createdRows.length > 0 ? <CopyButton value={credentials} label="Chép toàn bộ email + mật khẩu" /> : null}
          {failedEmails ? <CopyButton value={failedEmails} label="Chép email dòng lỗi" /> : null}
        </span>
      </div>

      {createdRows.length > 0 ? (
        <p className="mb-2 bg-(--tint-earth) px-3 py-2 text-sm text-earth">
          <strong>Chép mật khẩu trước khi rời trang.</strong> Hệ thống không lưu bản rõ; muốn có lại phải đặt lại mật
          khẩu từng tài khoản.
        </p>
      ) : null}

      <div className="overflow-x-auto border border-line">
        <table className="w-full text-sm">
          <caption className="sr-only">Kết quả nhập từng dòng CSV</caption>
          <thead className="bg-surface-1 text-left text-xs text-ink-5">
            <tr>
              <th scope="col" className="px-2 py-1.5">Dòng</th>
              <th scope="col" className="px-2 py-1.5">Email</th>
              <th scope="col" className="px-2 py-1.5">Trạng thái</th>
              <th scope="col" className="px-2 py-1.5">Mật khẩu / Lý do</th>
            </tr>
          </thead>
          <tbody>
            {report.results.map((row) => (
              <ReportRow key={`${row.line}:${row.email}`} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReportRow({ row }: { row: ImportRow }) {
  const created = row.status === 'created'
  return (
    <tr className="border-t border-line">
      <td className="px-2 py-1.5 font-mono text-xs tabular-nums text-ink-5">{row.line}</td>
      <td className="px-2 py-1.5 font-mono text-xs break-all">{row.email || '—'}</td>
      <td className="px-2 py-1.5">
        <span
          className={cn(
            'px-1.5 py-0.5 text-xs font-medium',
            created ? 'bg-surface-sel text-moss' : 'bg-(--tint-clay) text-clay',
          )}
        >
          {STATUS_LABEL[row.status] ?? row.status}
        </span>
      </td>
      <td className="px-2 py-1.5">
        {created && row.password ? (
          <span className="flex items-center gap-2">
            <code className="font-mono text-xs font-semibold select-all">{row.password}</code>
            <CopyButton value={row.password} />
          </span>
        ) : (
          <span className="text-xs text-ink-3">{row.message ?? '—'}</span>
        )}
      </td>
    </tr>
  )
}
