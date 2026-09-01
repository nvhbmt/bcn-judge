/**
 * Kết quả ghi danh theo danh sách email dán vào (US-1).
 *
 * Tiêu chí chấp nhận của US-1 là "email không tồn tại được LIỆT KÊ để admin xử
 * lý" — nên bốn nhóm hiện tách bạch, mỗi nhóm nói rõ việc phải làm và có nút
 * chép để dán thẳng sang bước sửa. Gộp tất cả thành một câu "có N lỗi" là hỏng
 * đúng cái story này yêu cầu.
 */
import { CheckCircle2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { EnrollReport } from './types'
import { CopyButton } from './ui'

export function EnrollResult({ report, invalid }: { report: EnrollReport; invalid: string[] }) {
  const clean = report.missing.length === 0 && report.notMember.length === 0 && invalid.length === 0

  return (
    <div className="mt-3" role="status">
      <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ac)]">
        <CheckCircle2 size={15} /> Đã ghi danh {report.enrolled} member
      </p>

      {clean ? (
        <p className="text-sm text-ink-5">Mọi email trong danh sách đều ghi danh được.</p>
      ) : null}

      <EmailGroup
        title={`${report.missing.length} email chưa có tài khoản`}
        emails={report.missing}
        action={
          <>
            Những địa chỉ này chưa tồn tại trong hệ thống. Tạo tài khoản trước ở trang{' '}
            <strong>Tài khoản</strong> (tạo lẻ hoặc nhập CSV có cột mã khoá để ghi danh luôn), rồi dán lại danh sách
            này.
          </>
        }
      />

      <EmailGroup
        title={`${report.notMember.length} email không phải vai trò Member`}
        emails={report.notMember}
        action={
          <>
            Tài khoản tồn tại nhưng đang là Mentor hoặc Admin — ghi danh chỉ dành cho Member. Nếu muốn họ phụ trách
            khoá, dùng mục <strong>Mentor phụ trách</strong> ở trên.
          </>
        }
      />

      <EmailGroup
        title={`${invalid.length} dòng không đúng định dạng email`}
        emails={invalid}
        action="Các dòng này đã bị loại trước khi gửi để phần còn lại vẫn ghi danh được. Sửa lỗi gõ rồi dán lại."
      />
    </div>
  )
}

function EmailGroup({ title, emails, action }: { title: string; emails: string[]; action: ReactNode }) {
  if (emails.length === 0) return null
  return (
    <div className="mt-2 border border-line bg-surface-1 p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <h4 className="text-sm font-medium">{title}</h4>
        <span className="ml-auto">
          <CopyButton value={emails.join('\n')} label="Chép danh sách" />
        </span>
      </div>
      <p className="mb-2 text-xs text-ink-3">{action}</p>
      <ul className="max-h-40 space-y-0.5 overflow-auto font-mono text-xs">
        {emails.map((email) => (
          <li key={email} className="break-all">
            {email}
          </li>
        ))}
      </ul>
    </div>
  )
}
