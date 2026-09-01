/** FR-A2: nhập hàng loạt tài khoản từ CSV, kèm ghi danh khoá theo mã (cột 4). */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '@/components/ui'
import { api } from '@/lib/api'
import { describeFailure, type FailureNotice } from './conflicts'
import { ImportReportTable } from './ImportReportTable'
import type { ImportReport } from './types'
import { FailureBanner, TextArea } from './ui'

const SAMPLE = `email,họ tên,vai trò,mã khoá
an.nguyen@bcn.local,Nguyễn Văn An,member,C-CB-K12
binh.tran@bcn.local,Trần Thị Bình,member,`

export function UserImportPanel({ onClose }: { onClose: () => void }) {
  const client = useQueryClient()
  const [csv, setCsv] = useState('')
  const [notice, setNotice] = useState<FailureNotice | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const runImport = useMutation({
    mutationFn: (payload: string) => api.post<ImportReport>('/api/admin/users/import', { csv: payload }),
    onSuccess: () => {
      setNotice(null)
      void client.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: (err) => setNotice(describeFailure(err, 'Không nhập được danh sách.')),
  })

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    // Đọc phía client rồi gửi như chuỗi: endpoint nhận `{csv}` JSON, không phải
    // multipart — đỡ phải dựng thêm đường tải lên chỉ cho một ô văn bản.
    void file.text().then((text) => setCsv(text))
  }

  return (
    <section className="border border-line bg-surface-2 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Nhập hàng loạt từ CSV</h2>
        <Button onClick={onClose} className="ml-auto">
          Đóng
        </Button>
      </div>

      <FailureBanner notice={notice} />

      <p className="mb-2 text-sm text-ink-5">
        Mỗi dòng: <code className="font-mono">email,họ tên,vai trò[,mã khoá]</code>. Vai trò là{' '}
        <code className="font-mono">member</code>, <code className="font-mono">mentor</code> hoặc{' '}
        <code className="font-mono">admin</code>. Cột mã khoá bỏ trống nếu chưa ghi danh. Dòng tiêu đề bắt đầu bằng{' '}
        <code className="font-mono">email,</code> được bỏ qua. Mật khẩu do hệ thống sinh cho từng dòng.
      </p>

      <TextArea
        rows={8}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder={SAMPLE}
        aria-label="Nội dung CSV"
        spellCheck={false}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          onClick={() => runImport.mutate(csv)}
          disabled={runImport.isPending || csv.trim().length === 0}
        >
          {runImport.isPending ? 'Đang nhập…' : 'Nhập danh sách'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={pickFile}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
        <Button onClick={() => fileRef.current?.click()}>Chọn tệp .csv…</Button>
        <Button onClick={() => setCsv(SAMPLE)}>Điền mẫu</Button>
      </div>

      {runImport.data ? <ImportReportTable report={runImport.data} /> : null}
    </section>
  )
}
