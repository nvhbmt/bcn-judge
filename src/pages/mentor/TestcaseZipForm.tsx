/**
 * FR-D4 — nạp cả bộ test bằng file zip `01.in` / `01.out`. Đây là đường chính của
 * US-2 ("đăng bài 10 testcase trong ≤ 10 phút"); bảng soạn tay là đường phụ.
 *
 * Ba điểm khớp thẳng với `POST /api/mentor/problems/:id/testcases/zip`:
 *   1. **multipart, không base64** — `api.upload` với `FormData`; server đọc
 *      `c.req.formData()` và tìm đúng ba trường `file`, `sampleCount`, `generate`.
 *      Base64 phình 33% trên file tới 64 MB.
 *   2. `sampleCount` là "N testcase ĐẦU là mẫu" — server gán
 *      `kind = position <= sampleCount ? 'sample' : 'hidden'`. Đúng câu US-2 nói:
 *      tải zip lên rồi đánh dấu hai cái đầu là mẫu.
 *   3. Thông báo lỗi của `ZipImportError` đã là tiếng Việt và ĐÃ NÊU TÊN FILE sai
 *      ("Entry \"1.txt\" không hợp lệ…"). Hiện nguyên văn, không gói lại bằng một
 *      câu chung chung — viết lại là ném đi đúng thứ mentor cần để sửa zip.
 */
import { Upload } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui'
import { api, ApiFailure } from '@/lib/api'
import { Field, Notice, TextInput } from './fields'

export interface ZipImportResult {
  count: number
  sampleCount: number
  warnings: string[]
}

export function TestcaseZipForm({
  problemId,
  onUploaded,
}: {
  problemId: string
  onUploaded: (result: ZipImportResult) => void
}) {
  const fileId = useId()
  const sampleId = useId()
  const generateId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [samples, setSamples] = useState('2')
  const [generate, setGenerate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('sampleCount', String(Number.parseInt(samples, 10) || 0))
      form.set('generate', generate ? 'true' : 'false')
      onUploaded(await api.upload<ZipImportResult>(`/api/mentor/problems/${problemId}/testcases/zip`, form))
      setFile(null)
    } catch (err) {
      setError(err instanceof ApiFailure ? err.error.message : 'Không tải được file zip lên.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Field
        id={fileId}
        label="File zip testcase"
        hint="Bên trong zip chỉ được có các file NN.in và NN.out ở gốc (01.in, 01.out, 02.in…), không thư mục con. Tối đa 500 file, 10 MB mỗi file, 64 MB cả zip."
      >
        <input
          id={fileId}
          type="file"
          accept=".zip,application/zip"
          aria-describedby={`${fileId}-hint`}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            setError(null)
          }}
          className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-sm dark:file:bg-slate-700"
        />
      </Field>

      <Field
        id={sampleId}
        label="Số testcase đầu làm MẪU"
        hint="Testcase mẫu là phần member nhìn thấy input/expected; phần còn lại thành ẩn. Đặt 2 là đúng kịch bản thường gặp: hai ví dụ trong đề."
      >
        <TextInput
          id={sampleId}
          type="number"
          min={0}
          value={samples}
          aria-describedby={`${sampleId}-hint`}
          onChange={(e) => setSamples(e.target.value)}
          className="max-w-28"
        />
      </Field>

      <label htmlFor={generateId} className="mb-3 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
        <input
          id={generateId}
          type="checkbox"
          checked={generate}
          onChange={(e) => setGenerate(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Cho phép zip thiếu file <code>.out</code> — expected để trống, sinh sau từ lời giải mẫu. Không tick thì
          zip thiếu <code>.out</code> sẽ bị từ chối kèm tên file thiếu.
        </span>
      </label>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <Button variant="primary" onClick={() => void upload()} disabled={!file || busy} className="mt-2">
        <Upload size={16} />
        {busy ? 'Đang tải lên…' : 'Tải lên & thay toàn bộ testcase'}
      </Button>
    </div>
  )
}
