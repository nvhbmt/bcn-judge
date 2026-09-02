/**
 * FR-D4 — nạp cả bộ test bằng file zip `01.in` / `01.out`. Đây là đường chính của
 * US-2 ("đăng bài 10 testcase trong ≤ 10 phút"); bảng soạn tay là đường phụ.
 *
 * Bố cục theo đúng thứ tự người dùng làm, không theo thứ tự trường của API: **chọn
 * file → thấy mình vừa chọn gì → đặt số test mẫu → tải lên**. Bản trước xếp ba
 * trường bằng vai nhau, mỗi trường một đoạn hướng dẫn dài, nên yêu cầu định dạng zip
 * (thứ phải đọc TRƯỚC khi đi tìm file) lại nằm lẫn giữa các ô nhập.
 *
 * Ba điểm khớp thẳng với `POST /api/mentor/problems/:id/testcases/zip`:
 *   1. **multipart, không base64** — `api.upload` với `FormData`; server đọc
 *      `c.req.formData()` và tìm đúng ba trường `file`, `sampleCount`, `generate`.
 *      Base64 phình 33% trên file tới 64 MB.
 *   2. `sampleCount` là "N testcase ĐẦU là mẫu" — server gán
 *      `kind = position <= sampleCount ? 'sample' : 'hidden'`.
 *   3. Thông báo lỗi của `ZipImportError` đã là tiếng Việt và ĐÃ NÊU TÊN FILE sai
 *      ("Entry \"1.txt\" không hợp lệ…"). Hiện nguyên văn, không gói lại bằng một
 *      câu chung chung — viết lại là ném đi đúng thứ mentor cần để sửa zip.
 */
import { FileArchive, Upload, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { api, ApiFailure } from '@/lib/api'
import { Notice, TextInput } from './fields'

export interface ZipImportResult {
  count: number
  sampleCount: number
  warnings: string[]
}

/** Cỡ file cho người đọc, không phải cho máy. */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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
  const inputRef = useRef<HTMLInputElement>(null)
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
      clear()
    } catch (err) {
      setError(err instanceof ApiFailure ? err.error.message : 'Không tải được file zip lên.')
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    setFile(null)
    // Xoá cả giá trị của input: không xoá thì chọn LẠI đúng file vừa bỏ sẽ không bắn
    // `change`, và người dùng bấm mãi mà màn hình không đổi.
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="border border-line bg-surface-1">
      {/* Yêu cầu định dạng đặt TRƯỚC ô chọn file: đây là thứ quyết định mentor phải
          đóng gói zip thế nào, đọc sau khi đã chọn file thì đã muộn. */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-line px-3 py-2.5 text-xs text-ink-5">
        <dt className="font-semibold text-ink-4">Cấu trúc</dt>
        <dd>
          <code>01.in</code> / <code>01.out</code>, <code>02.in</code> / <code>02.out</code>… ngay ở gốc zip,
          không thư mục con
        </dd>
        <dt className="font-semibold text-ink-4">Giới hạn</dt>
        <dd>tối đa 500 file · 10 MB mỗi file · 64 MB cả zip</dd>
        <dt className="font-semibold text-ink-4">Hệ quả</dt>
        <dd>tải lên là THAY toàn bộ bộ test cũ, và bài quay về “chưa kiểm”</dd>
      </dl>

      <div className="p-3">
        <label htmlFor={fileId} className="mb-1 block text-xs font-semibold text-ink-3">
          File zip
        </label>
        {file ? (
          <div className="mb-3 flex items-center gap-2 border border-line bg-surface-2 px-2.5 py-2">
            <FileArchive size={16} className="shrink-0 text-ink-5" />
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.name}</span>
            <span className="shrink-0 font-mono text-xs text-ink-6 tabular-nums">{humanSize(file.size)}</span>
            <Button onClick={clear} aria-label="Bỏ file đã chọn" className="shrink-0">
              <X size={14} />
            </Button>
          </div>
        ) : null}
        <input
          ref={inputRef}
          id={fileId}
          type="file"
          accept=".zip,application/zip"
          className={`w-full text-sm file:mr-3 file:border-0 file:bg-surface-sel file:px-3 file:py-1.5 file:text-sm ${
            file ? 'sr-only' : 'mb-3'
          }`}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            setError(null)
          }}
        />

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label htmlFor={sampleId} className="text-xs font-semibold text-ink-3">
            Số testcase đầu làm mẫu
          </label>
          <TextInput
            id={sampleId}
            type="number"
            min={0}
            value={samples}
            aria-describedby={`${sampleId}-hint`}
            onChange={(e) => setSamples(e.target.value)}
            // `max-w-*` chứ không phải `w-*`: CONTROL của TextInput đã có `w-full`, và
            // hai lớp width cùng độ đặc hiệu thì thắng thua do thứ tự trong file CSS
            // sinh ra, không do thứ tự viết trong className — nên `w-20` thua im lặng.
            className="max-w-24"
          />
          <span id={`${sampleId}-hint`} className="text-xs text-ink-5">
            member thấy input/expected của bấy nhiêu test đầu, phần còn lại thành ẩn
          </span>
        </div>

        <label htmlFor={generateId} className="mb-3 flex items-start gap-2 text-xs text-ink-5">
          <input
            id={generateId}
            type="checkbox"
            checked={generate}
            onChange={(e) => setGenerate(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span>
            Cho phép zip thiếu file <code>.out</code> — expected để trống, sinh sau từ lời giải mẫu. Không tick
            thì zip thiếu <code>.out</code> bị từ chối kèm tên file thiếu.
          </span>
        </label>

        {error ? <Notice tone="error">{error}</Notice> : null}

        <Button variant="primary" onClick={() => void upload()} disabled={!file || busy}>
          <Upload size={16} />
          {busy ? 'Đang tải lên…' : 'Tải lên & thay toàn bộ testcase'}
        </Button>
      </div>
    </div>
  )
}
