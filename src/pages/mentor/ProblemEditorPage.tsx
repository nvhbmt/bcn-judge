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
import { ArrowLeft, Save } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SplitPane } from '@/components/layout/SplitPane'
import { Button, Spinner } from '@/components/ui'
import { api, ApiFailure } from '@/lib/api'
import { ValidationBadge, validationState } from './badges'
import { Notice } from './fields'
import { toFormValues, toPatchPayload, validateForm, type ProblemFormValues } from './form'
import { ProblemForm } from './ProblemForm'
import { StatementPreview } from './StatementPreview'
import { TestcasePanel } from './TestcasePanel'
import { ValidateButton } from './ValidateButton'
import type { MentorProblemDetail, ProblemDetailMeta } from './types'

export function ProblemEditorPage() {
  const { problemId } = useParams()
  const client = useQueryClient()
  const [tab, setTab] = useState<'de-bai' | 'testcase'>('de-bai')
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
  const samples = detail.testcases.filter((t) => t.kind === 'sample').length
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
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
        <Link to="/mentor/bai-tap" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:underline">
          <ArrowLeft size={15} /> Bài tập
        </Link>
        <h1 className="truncate text-sm font-semibold">{values.title || 'Bài chưa đặt tên'}</h1>
        <ValidationBadge state={validationState({ testcases: detail.testcases.length, validated })} />
        <span className="font-mono text-xs text-slate-400">bộ test #{detail.testcaseRev}</span>

        <div className="ml-auto flex items-center gap-2">
          {dirty ? <span className="text-xs text-amber-700 dark:text-amber-300">Có thay đổi chưa lưu</span> : null}
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

      <ValidateButton
        problemId={problemId}
        testcaseCount={detail.testcases.length}
        hasSolution={initial.solutionSource.trim().length > 0 && initial.solutionLanguageId !== ''}
        dirty={dirty}
        validated={validated}
        onFinished={reload}
      />

      <div className="min-h-0 flex-1">
        <SplitPane
          storageKey="bcn:mentor-editor"
          defaultRatio={0.55}
          minPx={360}
          left={
            <div className="flex h-full min-h-0 flex-col">
              <div
                role="tablist"
                className="flex shrink-0 gap-1 border-b border-slate-200 px-2 pt-1 dark:border-slate-700"
              >
                <EditorTab id="de-bai" active={tab} onTab={setTab}>
                  Đề bài
                </EditorTab>
                <EditorTab id="testcase" active={tab} onTab={setTab}>
                  {`Testcase (${detail.testcases.length})`}
                </EditorTab>
              </div>
              {/* Cả hai thẻ luôn mount, chỉ ẩn bằng CSS — cùng kỷ luật với SplitPane
                  lúc thu gọn khung ("nội dung khung phải sống qua thu gọn/mở lại").
                  Đổi thẻ mà unmount thì bảng testcase đang gõ dở và lịch sử undo của
                  ô lời giải biến mất, im lặng, đúng lúc mentor đang soạn dở. */}
              <div className="min-h-0 flex-1 overflow-auto">
                <div id="panel-de-bai" role="tabpanel" aria-labelledby="tab-de-bai" hidden={tab !== 'de-bai'} inert={tab !== 'de-bai'}>
                  <ProblemForm values={values} onChange={(p) => setValues({ ...values, ...p })} />
                </div>
                <div
                  id="panel-testcase"
                  role="tabpanel"
                  aria-labelledby="tab-testcase"
                  hidden={tab !== 'testcase'}
                  inert={tab !== 'testcase'}
                >
                  <TestcasePanel
                    problemId={detail.id}
                    testcaseRev={detail.testcaseRev}
                    testcases={detail.testcases}
                    onReloaded={reload}
                  />
                </div>
              </div>
            </div>
          }
          right={
            <StatementPreview
              values={values}
              sampleCount={samples}
              hiddenCount={detail.testcases.length - samples}
            />
          }
        />
      </div>
    </div>
  )
}

function EditorTab({
  id,
  active,
  onTab,
  children,
}: {
  id: 'de-bai' | 'testcase'
  active: string
  onTab: (t: 'de-bai' | 'testcase') => void
  children: string
}) {
  return (
    <button
      id={`tab-${id}`}
      role="tab"
      aria-selected={active === id}
      aria-controls={`panel-${id}`}
      onClick={() => onTab(id)}
      className={`rounded-t-md px-3 py-1.5 text-sm font-medium ${
        active === id
          ? 'bg-slate-100 shadow-[inset_0_-2px_0_var(--color-primary)] dark:bg-slate-800'
          : 'text-slate-500'
      }`}
    >
      {children}
    </button>
  )
}
