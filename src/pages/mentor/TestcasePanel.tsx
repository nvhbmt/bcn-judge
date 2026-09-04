/**
 * FR-D4 — thẻ Testcase của trình soạn bài, dựng theo đúng thứ tự US-2:
 * **1) tải zip → 2) đánh dấu N testcase đầu là mẫu → 3) kiểm bằng lời giải mẫu.**
 * Ba bước được đánh số trên màn hình vì đây là màn hình mentor chỉ mở vài lần một
 * học kỳ; thứ tự phải đọc ra được, không phải nhớ.
 *
 * Cả hai đường ghi (`PUT .../testcases` và `POST .../testcases/zip`) đều XOÁ SẠCH
 * rồi ghi lại và `testcase_rev = testcase_rev + 1`. Hệ quả không được giấu:
 *   - bài nộp cũ giữ rev cũ → hiện thành "chấm trên bộ test cũ" và cần rejudge (FR-D9);
 *   - `validated_testcase_rev` lập tức lệch → bài rơi về "chưa kiểm" (FR-D6).
 * Vì vậy lưu bảng tay đi qua một bước xác nhận, còn nút zip nói thẳng hậu quả
 * ngay trên nhãn ("thay toàn bộ testcase") thay vì mở thêm một hộp thoại nữa.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui'
import { api, ApiFailure } from '@/lib/api'
import { Notice } from './fields'
import { TestcaseTable } from './TestcaseTable'
import { TestcaseZipForm, type ZipImportResult } from './TestcaseZipForm'
import { ValidateButton } from './ValidateButton'
import { sampleCount, testcaseError, toDrafts, toPutPayload, type TestcaseDraft } from './testcases'
import type { CompareMode, MentorTestcaseView } from './types'

export function TestcasePanel({
  problemId,
  testcaseRev,
  testcases,
  compareMode,
  hasSolution,
  dirty,
  validated,
  onReloaded,
}: {
  problemId: string
  testcaseRev: number
  testcases: MentorTestcaseView[]
  /** Bốn props dưới đây chỉ để chuyển tiếp cho nút kiểm ở bước 3 — xem ValidateButton. */
  compareMode: CompareMode
  hasSolution: boolean
  dirty: boolean
  validated: boolean
  onReloaded: () => void
}) {
  const [drafts, setDrafts] = useState<TestcaseDraft[]>(() => toDrafts(testcases))
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imported, setImported] = useState<ZipImportResult | null>(null)

  // Nạp lại bảng khi bộ test trên máy chủ đổi. Phụ thuộc là `testcaseRev` chứ KHÔNG
  // phải mảng `testcases`, và đó là chủ ý: react-query trả mảng mới mỗi lần refetch,
  // nên nạp lại theo mảng thì một lần lưu form (invalidate) sẽ xoá sạch bảng testcase
  // đang gõ dở. `testcase_rev` là bộ đếm phiên bản của chính máy chủ — cả hai đường
  // ghi đều bump nó, và không đường nào khác đổi được testcase — nên nó đúng bằng
  // "nội dung đã đổi", không hơn không kém.
  useEffect(() => {
    setDrafts(toDrafts(testcases))
    setConfirming(false)
  }, [problemId, testcaseRev])

  const blocking = testcaseError(drafts)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.put(`/api/mentor/problems/${problemId}/testcases`, toPutPayload(drafts))
      setConfirming(false)
      setImported(null)
      onReloaded()
    } catch (err) {
      setError(err instanceof ApiFailure ? err.error.message : 'Không lưu được testcase.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-4">
      <Step n={1} title="Nhập từ file">
        <TestcaseZipForm
          problemId={problemId}
          onUploaded={(result) => {
            setImported(result)
            setError(null)
            onReloaded()
          }}
        />
        {imported ? (
          <div className="mt-2 space-y-2">
            <Notice tone="ok">
              Đã nạp {imported.count} testcase, {imported.sampleCount} testcase đầu là mẫu. Bộ test cũ đã bị thay
              hoàn toàn và bài quay về trạng thái “chưa kiểm”.
            </Notice>
            {imported.warnings.map((w) => (
              <Notice key={w} tone="warn">
                {w}
              </Notice>
            ))}
          </div>
        ) : null}
      </Step>

      <Step
        n={2}
        title="Bộ testcase"
        hint="Testcase mẫu là phần member nhìn thấy được; testcase ẩn chỉ lộ ra dưới dạng con số. Zip đã đặt sẵn theo ô “số testcase đầu làm mẫu”, sửa lại ở đây nếu cần."
      >
        <TestcaseTable drafts={drafts} onChange={setDrafts} />

        <div className="mt-3 border-t border-line pt-3">
          {blocking ? <Notice tone="error">{blocking}</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}

          {confirming && !blocking ? (
            <div className="space-y-2">
              <Notice tone="warn">
                Lưu sẽ <strong>xoá toàn bộ {testcases.length} testcase hiện có</strong> và ghi lại{' '}
                {drafts.length} testcase ({sampleCount(drafts)} mẫu). Số hiệu bộ test tăng lên {testcaseRev + 1}:
                mọi bài nộp cũ bị đánh dấu là chấm trên bộ test cũ và bài phải kiểm lại.
              </Notice>
              <div className="flex gap-2">
                <Button variant="danger" onClick={() => void save()} disabled={saving}>
                  {saving ? 'Đang lưu…' : 'Vẫn thay toàn bộ testcase'}
                </Button>
                <Button onClick={() => setConfirming(false)} disabled={saving}>
                  Huỷ
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="primary" onClick={() => setConfirming(true)} disabled={blocking !== null}>
              Lưu bảng testcase…
            </Button>
          )}
        </div>
      </Step>

      <Step n={3} title="Kiểm bằng lời giải mẫu">
        <ValidateButton
          problemId={problemId}
          testcases={testcases}
          compareMode={compareMode}
          testcaseCount={testcases.length}
          hasSolution={hasSolution}
          dirty={dirty}
          validated={validated}
          onFinished={onReloaded}
        />
      </Step>
    </div>
  )
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-5 place-items-center bg-primary text-xs text-on-accent">
          {n}
        </span>
        {title}
      </h3>
      {hint ? <p className="mb-2 text-xs text-ink-5">{hint}</p> : null}
      {children}
    </section>
  )
}
