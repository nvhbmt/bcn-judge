import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconRail } from '@/components/layout/IconRail'
import { Workspace } from '@/components/layout/Workspace'
import { useSubmissionStream } from '@/hooks/useSubmissionStream'
import { api, ApiFailure } from '@/lib/api'
import { useDraft } from '@/lib/drafts'
import { useAuth } from '@/stores/auth'
import type { LanguageOption, ProblemView, SubmissionView } from '@/types/api'
import type { ConsoleTab } from './ConsolePanel'
import { ContentPanels } from './ContentPanels'
import { EditorPane } from './EditorPane'
import { RAIL_ITEMS, RAIL_ITEMS_LESSON, RAIL_LABEL, type RailKey } from './rail'
import { SolvedDialog } from './SolvedDialog'
import { useSolvedDialog } from './useSolvedDialog'
import { useSiblings } from './siblings'

/**
 * Màn hình làm bài (FR-E1): thanh icon · khung nội dung · khung code.
 *
 * Khung nội dung có MỘT lớp tab duy nhất (FR-E7 v0.5, bản v2): thanh icon chọn đang
 * xem gì — Đề bài · Bài nộp · Giáo trình · BXH · Trợ giúp — và dòng tiêu đề 38px chỉ
 * nói tên mục đó cùng nút nhảy sang bài kề. Bản trước có hai lớp (thanh icon CỘNG một
 * dải tab Đề bài/Bài nộp), đúng thứ bản v2 đặt ra để bỏ.
 */
export function WorkspacePage() {
  const { itemId, contestProblemId, courseId, contestId } = useParams()
  const { me } = useAuth()
  const [rail, setRail] = useState<RailKey>('de-bai')
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>('ket-qua')
  const [languageId, setLanguageId] = useState('c11')
  const [customInput, setCustomInput] = useState('')
  const [busy, setBusy] = useState<'run' | 'submit' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [watchedId, setWatchedId] = useState<string | null>(null)
  // Hai lượt chạy được theo dõi RIÊNG, vì chúng trả lời hai câu hỏi khác nhau và hiện
  // ở hai tab khác nhau. Dùng chung một id thì chạy stdin sẽ xoá mất bảng kết quả
  // testcase mẫu vừa xem — đúng lúc người ta đang lấy nó làm mốc để dò.
  const [sampleRunId, setSampleRunId] = useState<string | null>(null)
  const [customRunId, setCustomRunId] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleQuery = contestProblemId ? `contestProblemId=${contestProblemId}` : `itemId=${itemId}`

  // Loại của mục lấy từ giáo trình mà màn này VỐN ĐÃ nạp (xem useSiblings) — không tốn
  // thêm vòng mạng nào. Biết sớm là để không gọi endpoint bài tập cho một bài đọc: gọi
  // thì chắc chắn 404, và đó chính là loạt 404 rải khắp log.
  const siblings = useSiblings({ courseId, itemId, contestId, contestProblemId })
  const laBaiDoc = siblings.kind === 'lesson'

  const { data: problemResult, isLoading } = useQuery({
    queryKey: ['problem', handleQuery],
    queryFn: () => api.getWithMeta<ProblemView>(`/api/member/problems?${handleQuery}`),
    // Chỉ hỏi khi đã BIẾT CHẮC mục không phải bài đọc. Bắn sớm thì mọi bài đọc đều tạo
    // một 404 — không phải lỗi vô hại: nó lẫn vào log và che mất 404 thật.
    //
    // Trên đường khoá học, giáo trình gần như luôn đã nằm sẵn trong cache (vừa đi qua
    // trang khoá hoặc panel Giáo trình) nên chờ ở đây không tốn gì; chỉ khi mở thẳng
    // bằng URL nguội mới mất thêm một vòng. `resolved` bảo đảm không chờ vô hạn khi
    // giáo trình lỗi — lúc đó vẫn hỏi, và 404 nhận về là 404 THẬT.
    enabled: siblings.resolved && !laBaiDoc,
  })
  const problem = problemResult?.data
  const meta = problemResult?.meta
  const { data: languages } = useQuery({
    queryKey: ['languages'],
    queryFn: () => api.get<LanguageOption[]>('/api/member/languages'),
  })

  const draftKey = useMemo(
    () => ({ userId: me?.id ?? 'anon', problemId: problem?.id ?? handleQuery, languageId }),
    [me?.id, problem?.id, handleQuery, languageId],
  )
  const [source, setSource, draftStatus, draftSavedAt] = useDraft(draftKey, problem?.starterCode?.[languageId] ?? '')

  const { submission } = useSubmissionStream(watchedId)
  const { submission: sampleRun } = useSubmissionStream(sampleRunId)
  const { submission: customRun } = useSubmissionStream(customRunId)

  const allowed = useMemo(
    () => (languages ?? []).filter((l) => !problem?.allowedLanguageIds || problem.allowedLanguageIds.includes(l.id)),
    [languages, problem],
  )

  const send = useCallback(
    async (kind: 'run' | 'submit', target: 'samples' | 'custom' = 'samples') => {
      setBusy(kind)
      setError(null)
      try {
        const payload = {
          ...(contestProblemId ? { contestProblemId } : { itemId }),
          languageId,
          source,
          // Đích của lượt chạy do NÚT quyết định, không suy từ chỗ ô stdin có chữ hay
          // không: nút trên thanh luôn chạy testcase mẫu, nút trong tab stdin luôn chạy
          // input tự nhập. Kiểu đoán ý cũ làm một cú bấm có hai nghĩa mà không báo gì.
          ...(kind === 'run' ? { target, customInput: target === 'custom' ? customInput : undefined } : {}),
        }
        const res = await api.post<{ id: string }>(
          kind === 'submit' ? '/api/member/submissions' : '/api/member/submissions/runs',
          payload,
        )
        if (kind === 'submit') {
          setWatchedId(res.id)
          setConsoleTab('ket-qua')
        } else if (target === 'custom') {
          setCustomRunId(res.id)
          setConsoleTab('stdin')
        } else {
          setSampleRunId(res.id)
          setConsoleTab('chay-thu')
        }
      } catch (err) {
        setError(err instanceof ApiFailure ? err.error.message : 'Không gửi được.')
      } finally {
        setBusy(null)
      }
    },
    [contestProblemId, itemId, languageId, source, customInput],
  )

  const loadIntoEditor = useCallback(
    (s: SubmissionView) => {
      if (s.languageId !== languageId) setLanguageId(s.languageId)
      if (s.source) setSource(s.source)
    },
    [languageId, setSource],
  )

  // Đổi bài thì luôn quay về Đề bài. Không làm vậy thì bấm một bài ở Giáo trình sẽ
  // nạp bài mới nhưng vẫn đứng ở panel Giáo trình — người dùng tưởng cú bấm không ăn.
  const handle = contestProblemId ?? itemId
  useEffect(() => {
    setRail('de-bai')
    // Sang bài khác thì kết quả bài cũ không còn của màn này — reset để tab Kết quả
    // không hiện AC của bài trước. (Cổng mừng AC tự reset theo `handle`, xem hook.)
    setWatchedId(null)
  }, [handle])

  const solved = useSolvedDialog(submission, watchedId, handle)

  // "Đề bài" là sai tên cho một trang lý thuyết — và nhãn này còn là tên tab ở màn hẹp.
  const contentLabel = rail === 'de-bai' && laBaiDoc ? 'Bài đọc' : RAIL_LABEL[rail]
  // Truy vấn ĐANG TẮT thì react-query báo isLoading = false, nên nếu chỉ nhìn nó thì
  // trong lúc còn chờ giáo trình màn hình đã kết luận "không mở được" rồi mới đi hỏi.
  const dangCho = !siblings.resolved || isLoading
  // FR-I6: sau giờ kết thúc contest vẫn nộp và chấm được, nhưng không tính BXH.
  const contestEndAt = meta?.contestEndAt as string | undefined
  const practiceMode = Boolean(contestEndAt && new Date(contestEndAt) <= new Date())

  const content = (
    <ContentPanels
      contentLabel={contentLabel}
      rail={rail}
      siblings={siblings}
      dangCho={dangCho}
      role={me?.role ?? 'member'}
      courseId={courseId}
      itemId={itemId}
      contestId={contestId}
      contestProblemId={contestProblemId}
      laBaiDoc={laBaiDoc}
      problem={problem}
      handleQuery={handleQuery}
      watchedId={watchedId}
      languages={languages ?? []}
      onSelectSubmission={(id) => {
        setWatchedId(id)
        setConsoleTab('ket-qua')
      }}
      onLoadIntoEditor={loadIntoEditor}
    />
  )

  const editor = laBaiDoc ? undefined : (
    <EditorPane
      languages={allowed}
      languageId={languageId}
      onLanguage={setLanguageId}
      source={source}
      onSource={setSource}
      draftStatus={draftStatus}
      draftSavedAt={draftSavedAt}
      busy={busy}
      error={error}
      onRun={() => void send('run', 'samples')}
      onRunCustom={() => void send('run', 'custom')}
      onSubmit={() => void send('submit')}
      consoleTab={consoleTab}
      onConsoleTab={setConsoleTab}
      customInput={customInput}
      onCustomInput={setCustomInput}
      sampleRun={sampleRun}
      customRun={customRun}
      customRunPending={customRunId !== null && customRun === null}
      submission={submission}
      samples={problem?.samples ?? []}
      compareMode={problem?.compareMode ?? 'trim'}
      practiceMode={practiceMode}
    />
  )

  return (
    <>
    <Workspace
      storageKey="bcn:workspace"
      contentLabel={contentLabel}
      rail={
        <IconRail
          items={laBaiDoc ? RAIL_ITEMS_LESSON : RAIL_ITEMS}
          activeKey={rail}
          onSelect={(key) => setRail(key as RailKey)}
        />
      }
      content={content}
      editor={editor}
    />
      {solved.open && submission ? (
        <SolvedDialog
          score={submission.score}
          next={siblings.next}
          onStay={solved.close}
          onNext={() => {
            solved.close()
            if (siblings.next) navigate(siblings.next.href)
          }}
        />
      ) : null}
    </>
  )
}
