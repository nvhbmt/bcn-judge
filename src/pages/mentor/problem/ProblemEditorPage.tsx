/**
 * FR-D1…D7 — trình soạn bài tập. Khung trái là form, khung phải là đề bài dựng sống.
 *
 * Ba quyết định đáng ghi lại:
 *
 *  1. **Nút Kiểm tra nằm NGOÀI vạch chia**, trên một băng riêng chạy hết chiều ngang.
 *     Nó là cửa ra của US-2, không phải một trường của form; nhét nó vào cột trái thì
 *     nó trôi khỏi màn hình ngay khi mentor cuộn xuống ô lời giải.
 *  2. **Form chỉ nạp lại khi ĐỔI BÀI**, không phải mỗi lần `detail` đổi. Lưu testcase
 *     làm invalidate cả query bài; nạp lại theo mọi thay đổi thì chữ đang gõ dở ở
 *     khung trái bay mất ngay lúc mentor lưu bảng testcase.
 *  3. `initial` giữ riêng khỏi `values` để `PATCH` chỉ mang trường đã đổi — bắt buộc,
 *     vì server dùng `COALESCE` nên "gửi tất" và "không đổi gì" là hai chuyện khác nhau
 *     (xem `form.ts`).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SplitPane } from '@/components/layout/SplitPane'
import { Button, Spinner } from '@/components/ui'
import { api, ApiFailure } from '@/lib/api'
import { ValidationBadge, validationState } from '@/pages/mentor/badges'
import { Notice } from '@/pages/mentor/fields'
import { toFormValues, toPatchPayload, validateForm, type ProblemFormValues } from '@/pages/mentor/form'
import { EditorTabs, type EditorTabId } from './EditorTabs'
import { StatementPreview } from './StatementPreview'
import type { MentorProblemDetail, ProblemDetailMeta } from '@/pages/mentor/types'

export function ProblemEditorPage() {
  const { problemId } = useParams()
  const client = useQueryClient()
  const [tab, setTab] = useState<EditorTabId>('de-bai')
  const [initial, setInitial] = useState<ProblemFormValues | null>(null)
  const [values, setValues] = useState<ProblemFormValues | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['mentor', 'problem', problemId],
    queryFn: () => api.getWithMeta<MentorProblemDetail>(`/api/mentor/problems/${problemId}`),
    enabled: Boolean(problemId),
  })
  const detail = data?.data
  const meta = data?.meta as ProblemDetailMeta | undefined

  // Chỉ nạp form khi đổi bài — xem quyết định 2 ở đầu file.
  useEffect(() => {
    if (!detail) return
    const seeded = toFormValues(detail)
    setInitial(seeded)
    setValues(seeded)
  }, [detail?.id])

  const reload = useCallback(() => {
    void client.invalidateQueries({ queryKey: ['mentor', 'problem', problemId] })
    void client.invalidateQueries({ queryKey: ['mentor', 'problems'] })
  }, [client, problemId])

  if (isLoading || !detail || !values || !initial) {
    return (
      <div className="grid h-full place-items-center">
        {isError ? <Notice tone="error">Không mở được bài tập này.</Notice> : <Spinner />}
      </div>
    )
  }

  const patch = toPatchPayload(initial, values)
  const dirty = Object.keys(patch).length > 0
  const validated = meta?.validated === true

  const save = async () => {
    const message = validateForm(values)
    if (message !== null) {
      setSaveError(message)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await api.patch(`/api/mentor/problems/${problemId}`, patch)
      setInitial(values)
      reload()
    } catch (err) {
      setSaveError(err instanceof ApiFailure ? err.error.message : 'Không lưu được bài tập.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-2">
        <Link to="/mentor/bai-tap" className="inline-flex items-center gap-1 text-sm text-ink-5 hover:underline">
          <ArrowLeft size={15} /> Bài tập
        </Link>
        <h1 className="truncate font-display text-[16px] text-ink-1">{values.title || 'Bài chưa đặt tên'}</h1>
        <ValidationBadge state={validationState({ testcases: detail.testcases.length, validated })} />
        <span className="font-mono text-xs text-ink-6">bộ test #{detail.testcaseRev}</span>

        <div className="ml-auto flex items-center gap-2">
          {dirty ? <span className="text-xs text-earth">Có thay đổi chưa lưu</span> : null}
          {/* Sửa xong bài thì câu hỏi kế tiếp là "học viên làm ra sao". Là màn RIÊNG
              chứ không phải tab thứ ba ở đây: nó cần cả hai khung (danh sách + mã
              nguồn), mà khung phải của màn này đang là bản xem trước đề. */}
          <Link to={`/mentor/bai-tap/${detail.id}/bai-nop`}>
            <Button>
              <Users size={16} /> Xem bài nộp
            </Button>
          </Link>
          <Button variant="primary" onClick={() => void save()} disabled={saving || !dirty}>
            <Save size={16} /> {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </div>
        {saveError ? (
          <div className="w-full">
            <Notice tone="error">{saveError}</Notice>
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1">
        <SplitPane
          storageKey="bcn:mentor-editor"
          defaultRatio={0.55}
          minPx={360}
          left={
            <EditorTabs
              tab={tab}
              onTab={setTab}
              values={values}
              onChange={(p) => setValues({ ...values, ...p })}
              detail={detail}
              hasSolution={initial.solutionSource.trim().length > 0 && initial.solutionLanguageId !== ''}
              dirty={dirty}
              validated={validated}
              onReloaded={reload}
            />
          }
          right={
            <StatementPreview values={values} testcases={detail.testcases} />
          }
        />
      </div>
    </div>
  )
}

