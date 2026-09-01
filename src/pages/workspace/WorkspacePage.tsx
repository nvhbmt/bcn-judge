import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IconRail } from '@/components/layout/IconRail'
import { Workspace } from '@/components/layout/Workspace'
import { Markdown } from '@/components/markdown/Markdown'
import { Spinner } from '@/components/ui'
import { useSubmissionStream } from '@/hooks/useSubmissionStream'
import { api, ApiFailure } from '@/lib/api'
import { useDraft } from '@/lib/drafts'
import { useAuth } from '@/stores/auth'
import type { LanguageOption, ProblemView, SubmissionView } from '@/types/api'
import { ContestProblemList } from './ContestProblemList'
import { EditorPane } from './EditorPane'
import { HelpPanel } from './HelpPanel'
import { LeaderboardPanel } from './LeaderboardPanel'
import { RAIL_ITEMS, RAIL_LABEL, type RailKey } from './rail'
import { StatementPanel } from './StatementPanel'
import { SubmissionsPanel } from './SubmissionsPanel'
import { SyllabusPanel } from './SyllabusPanel'

/**
 * Màn hình làm bài (FR-E1): thanh icon · khung nội dung · khung code.
 *
 * Khung nội dung có HAI chế độ (FR-E7 v0.5): *chế độ mục* khi chọn một icon
 * (Mô tả/Giáo trình/BXH/Trợ giúp chiếm toàn khung, icon đó sáng), và *chế độ bài*
 * khi đang mở một bài (dải tab Đề bài/Bài nộp, KHÔNG icon nào sáng).
 */
export function WorkspacePage() {
  const { itemId, contestProblemId, courseId, contestId } = useParams()
  const { me } = useAuth()
  const [rail, setRail] = useState<RailKey | null>(null)
  const [problemTab, setProblemTab] = useState<'de-bai' | 'bai-nop'>('de-bai')
  const [consoleTab, setConsoleTab] = useState<'chay-thu' | 'ket-qua'>('ket-qua')
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
  const [source, setSource, draftStatus] = useDraft(draftKey, problem?.starterCode?.[languageId] ?? '')

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

  const contentLabel = rail ? RAIL_LABEL[rail] : problemTab === 'de-bai' ? 'Đề bài' : 'Bài nộp'
  // FR-I6: sau giờ kết thúc contest vẫn nộp và chấm được, nhưng không tính BXH.
  const contestEndAt = meta?.contestEndAt as string | undefined
  const practiceMode = Boolean(contestEndAt && new Date(contestEndAt) <= new Date())

  const content = (
    <div className="flex h-full min-h-0 flex-col">
      {rail === null ? (
        <div role="tablist" className="flex shrink-0 gap-1 border-b border-line px-2 pt-1">
          <ProblemTab id="de-bai" active={problemTab} onTab={setProblemTab}>
            Đề bài
          </ProblemTab>
          <ProblemTab id="bai-nop" active={problemTab} onTab={setProblemTab}>
            Bài nộp
          </ProblemTab>
          <Link to={courseId ? `/khoa-hoc/${courseId}` : '/'} className="ml-auto self-center px-2 text-xs text-ink-5 hover:underline">
            ← Danh sách
          </Link>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {/* Cột nội dung phải LUÔN có đúng một <h1>. Trước đây h1 duy nhất nằm trong
            StatementPanel, mà panel đó chỉ hiện khi rail === null — nên ở bốn trạng
            thái rail còn lại (trợ giúp, mô tả, giáo trình, bảng xếp hạng) cả trang
            không có tiêu đề cấp 1 nào, và người dùng trình đọc màn hình mất mốc điều
            hướng. Ở đây h1 ẩn về thị giác vì mỗi panel đã tự có nhan đề nhìn thấy. */}
        {rail !== null ? <h1 className="sr-only">{contentLabel}</h1> : null}
        {isLoading ? <div className="p-4"><Spinner /></div> : null}
        {rail === 'tro-giup' ? <HelpPanel role={me?.role ?? 'member'} /> : null}
        {rail === 'mo-ta' ? (
          <div className="px-4 py-4">
            <Markdown source={problem ? `## ${problem.title}\n\n${problem.statementMd}` : 'Đang tải…'} />
          </div>
        ) : null}
        {rail === 'giao-trinh' ? (
          courseId ? (
            <SyllabusPanel courseId={courseId} currentItemId={itemId} />
          ) : (
            <ContestProblemList contestId={contestId} currentId={contestProblemId} />
          )
        ) : null}
        {rail === 'bang-xep-hang' ? <LeaderboardPanel courseId={courseId} contestId={contestId} /> : null}
        {rail === null && problem ? (
          problemTab === 'de-bai' ? (
            <StatementPanel problem={problem} />
          ) : (
            <SubmissionsPanel
              handleQuery={handleQuery}
              selectedId={watchedId}
              onSelect={(id) => {
                setWatchedId(id)
                setConsoleTab('ket-qua')
              }}
              onLoadIntoEditor={loadIntoEditor}
            />
          )
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
          onSelect={(key) => setRail((cur) => (cur === key ? null : (key as RailKey)))}
        />
      }
      content={content}
      editor={editor}
    />
  )
}

function ProblemTab({
  id,
  active,
  onTab,
  children,
}: {
  id: 'de-bai' | 'bai-nop'
  active: string
  onTab: (t: 'de-bai' | 'bai-nop') => void
  children: string
}) {
  return (
    <button
      role="tab"
      aria-selected={active === id}
      onClick={() => onTab(id)}
      className={`px-3 py-1.5 text-sm font-medium ${
        active === id
          ? 'bg-surface-1 shadow-[inset_0_-2px_0_var(--color-primary)]'
          : 'text-ink-5'
      }`}
    >
      {children}
    </button>
  )
}
