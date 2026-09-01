import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { HSplit } from '@/components/layout/HSplit'
import { IconRail } from '@/components/layout/IconRail'
import { Workspace } from '@/components/layout/Workspace'
import { Markdown } from '@/components/markdown/Markdown'
import { Button, Spinner, VerdictBadge } from '@/components/ui'
import { useSubmissionStream } from '@/hooks/useSubmissionStream'
import { api, ApiFailure } from '@/lib/api'
import { useDraft } from '@/lib/drafts'
import { useAuth } from '@/stores/auth'
import type { LanguageOption, ProblemView, SubmissionView } from '@/types/api'
import { ConsolePanel } from './ConsolePanel'
import { HelpPanel } from './HelpPanel'
import { RAIL_ITEMS, RAIL_LABEL, type RailKey } from './rail'
import { StatementPanel } from './StatementPanel'
import { SubmissionsPanel } from './SubmissionsPanel'

/**
 * Màn hình làm bài (FR-E1): thanh icon · khung nội dung · khung code.
 *
 * Khung nội dung có HAI chế độ (FR-E7 v0.5): *chế độ mục* khi chọn một icon
 * (Mô tả/Giáo trình/BXH/Trợ giúp chiếm toàn khung, icon đó sáng), và *chế độ bài*
 * khi đang mở một bài (dải tab Đề bài/Bài nộp, KHÔNG icon nào sáng).
 */
export function WorkspacePage() {
  const { itemId, contestProblemId, courseId } = useParams()
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

  const { data: problem, isLoading } = useQuery({
    queryKey: ['problem', handleQuery],
    queryFn: () => api.get<ProblemView>(`/api/member/problems?${handleQuery}`),
  })
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

  const content = (
    <div className="flex h-full min-h-0 flex-col">
      {rail === null ? (
        <div role="tablist" className="flex shrink-0 gap-1 border-b border-slate-200 px-2 pt-1 dark:border-slate-700">
          <ProblemTab id="de-bai" active={problemTab} onTab={setProblemTab}>
            Đề bài
          </ProblemTab>
          <ProblemTab id="bai-nop" active={problemTab} onTab={setProblemTab}>
            Bài nộp
          </ProblemTab>
          <Link to={courseId ? `/khoa-hoc/${courseId}` : '/'} className="ml-auto self-center px-2 text-xs text-slate-500 hover:underline">
            ← Danh sách
          </Link>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? <div className="p-4"><Spinner /></div> : null}
        {rail === 'tro-giup' ? <HelpPanel role={me?.role ?? 'member'} /> : null}
        {rail === 'mo-ta' ? (
          <div className="px-4 py-4">
            <Markdown source={problem ? `## ${problem.title}\n\n${problem.statementMd}` : 'Đang tải…'} />
          </div>
        ) : null}
        {rail === 'giao-trinh' ? (
          <p className="p-4 text-sm text-slate-500">Cây chương/mục của khoá — hoàn thiện ở phase nội dung khoá học.</p>
        ) : null}
        {rail === 'bang-xep-hang' ? (
          <p className="p-4 text-sm text-slate-500">Bảng xếp hạng — hoàn thiện ở phase contest.</p>
        ) : null}
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-2 py-1.5 dark:border-slate-700">
        <select
          aria-label="Ngôn ngữ"
          value={languageId}
          onChange={(e) => setLanguageId(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
        >
          {allowed.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} {l.versionLabel ?? ''}
            </option>
          ))}
        </select>
        {submission ? <VerdictBadge verdict={submission.verdict} pending={submission.status !== 'done'} /> : null}
        <span className="text-xs text-slate-400" aria-live="polite">
          {draftStatus === 'saving' ? 'Đang lưu nháp…' : draftStatus === 'error' ? 'Không lưu được nháp' : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => void send('run')} disabled={busy !== null}>
            {busy === 'run' ? 'Đang chạy…' : 'Chạy thử'}
          </Button>
          <Button variant="primary" onClick={() => void send('submit')} disabled={busy !== null}>
            {busy === 'submit' ? 'Đang nộp…' : 'Nộp bài'}
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="shrink-0 bg-red-50 px-3 py-1.5 text-xs text-[var(--color-wa)] dark:bg-red-950/40">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1">
        <HSplit
          storageKey="bcn:console"
          defaultRatio={0.62}
          top={
            <CodeEditor
              value={source}
              onChange={setSource}
              languageId={languageId}
              onRun={() => void send('run')}
              onSubmit={() => void send('submit')}
              ariaLabel="Ô soạn code"
            />
          }
          bottom={
            <ConsolePanel
              tab={consoleTab}
              onTab={setConsoleTab}
              customInput={customInput}
              onCustomInput={setCustomInput}
              runResult={runResult}
              submission={submission}
            />
          }
        />
      </div>
    </div>
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
