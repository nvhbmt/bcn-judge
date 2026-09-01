import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { IconRail } from '@/components/layout/IconRail'
import { Workspace } from '@/components/layout/Workspace'
import { EmptyState, Spinner } from '@/components/ui'
import { useSubmissionStream } from '@/hooks/useSubmissionStream'
import { api, ApiFailure } from '@/lib/api'
import { useDraft } from '@/lib/drafts'
import { useAuth } from '@/stores/auth'
import type { LanguageOption, ProblemView, SubmissionView } from '@/types/api'
import type { ConsoleTab } from './ConsolePanel'
import { ContestProblemList } from './ContestProblemList'
import { ContentHeader } from './ContentHeader'
import { EditorPane } from './EditorPane'
import { HelpPanel } from './HelpPanel'
import { LeaderboardPanel } from './LeaderboardPanel'
import { NoteBanner } from './NoteBanner'
import { RAIL_ITEMS, RAIL_LABEL, type RailKey } from './rail'
import { StatementPanel } from './StatementPanel'
import { SubmissionsPanel } from './SubmissionsPanel'
import { useSiblings } from './siblings'
import { SyllabusPanel } from './SyllabusPanel'

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
  const [runId, setRunId] = useState<string | null>(null)

  const handleQuery = contestProblemId ? `contestProblemId=${contestProblemId}` : `itemId=${itemId}`

  const { data: problemResult, isLoading } = useQuery({
    queryKey: ['problem', handleQuery],
    queryFn: () => api.getWithMeta<ProblemView>(`/api/member/problems?${handleQuery}`),
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
  const { submission: runResult } = useSubmissionStream(runId)

  const allowed = useMemo(
    () => (languages ?? []).filter((l) => !problem?.allowedLanguageIds || problem.allowedLanguageIds.includes(l.id)),
    [languages, problem],
  )

  const send = useCallback(
    async (kind: 'run' | 'submit') => {
      setBusy(kind)
      setError(null)
      try {
        const payload = {
          ...(contestProblemId ? { contestProblemId } : { itemId }),
          languageId,
          source,
          ...(kind === 'run'
            ? { target: customInput.trim() ? 'custom' : 'samples', customInput: customInput || undefined }
            : {}),
        }
        const res = await api.post<{ id: string }>(
          kind === 'submit' ? '/api/member/submissions' : '/api/member/submissions/runs',
          payload,
        )
        if (kind === 'submit') {
          setWatchedId(res.id)
          setConsoleTab('ket-qua')
        } else {
          setRunId(res.id)
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
  }, [handle])

  const siblings = useSiblings({ courseId, itemId, contestId, contestProblemId })
  const contentLabel = RAIL_LABEL[rail]
  // FR-I6: sau giờ kết thúc contest vẫn nộp và chấm được, nhưng không tính BXH.
  const contestEndAt = meta?.contestEndAt as string | undefined
  const practiceMode = Boolean(contestEndAt && new Date(contestEndAt) <= new Date())

  const content = (
    <div className="flex h-full min-h-0 flex-col">
      <ContentHeader
        label={contentLabel}
        // Panel Đề bài tự mang <h1> (tên bài) — nhãn ở đây lùi về chữ thường để màn
        // hình chỉ có đúng MỘT tiêu đề cấp 1.
        asHeading={rail !== 'de-bai'}
        position={rail === 'de-bai' || rail === 'bai-nop' ? siblings.position : undefined}
        prev={rail === 'de-bai' || rail === 'bai-nop' ? siblings.prev : null}
        next={rail === 'de-bai' || rail === 'bai-nop' ? siblings.next : null}
      />

      {/* Ghi chú leader gửi cho mình (FR-J6) — bản vẽ đặt nó ở đúng màn này. */}
      <NoteBanner />

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4">
            <Spinner />
          </div>
        ) : null}
        {rail === 'tro-giup' ? <HelpPanel role={me?.role ?? 'member'} /> : null}
        {rail === 'giao-trinh' ? (
          courseId ? (
            <SyllabusPanel courseId={courseId} currentItemId={itemId} />
          ) : (
            <ContestProblemList contestId={contestId} currentId={contestProblemId} />
          )
        ) : null}
        {rail === 'bang-xep-hang' ? <LeaderboardPanel courseId={courseId} contestId={contestId} /> : null}
        {rail === 'de-bai' ? (
          problem ? (
            <StatementPanel problem={problem} />
          ) : isLoading ? null : (
            // Không có bài mà không nói gì thì khung nội dung trống trơn, trông như
            // app treo. Gặp thật khi mở một link cũ sau lúc dữ liệu bị dựng lại.
            <EmptyState
              title="Không mở được bài này"
              hint="Bài có thể đã bị gỡ, hoặc bạn chưa được ghi danh vào khoá chứa nó."
            />
          )
        ) : null}
        {rail === 'bai-nop' ? (
          <SubmissionsPanel
            handleQuery={handleQuery}
            selectedId={watchedId}
            onSelect={(id) => {
              setWatchedId(id)
              setConsoleTab('ket-qua')
            }}
            onLoadIntoEditor={loadIntoEditor}
          />
        ) : null}
      </div>
    </div>
  )

  const editor = (
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
      onRun={() => void send('run')}
      onSubmit={() => void send('submit')}
      consoleTab={consoleTab}
      onConsoleTab={setConsoleTab}
      customInput={customInput}
      onCustomInput={setCustomInput}
      runResult={runResult}
      submission={submission}
      practiceMode={practiceMode}
    />
  )

  return (
    <Workspace
      storageKey="bcn:workspace"
      contentLabel={contentLabel}
      rail={
        <IconRail
          items={RAIL_ITEMS}
          activeKey={rail}
          onSelect={(key) => setRail(key as RailKey)}
        />
      }
      content={content}
      editor={editor}
    />
  )
}
