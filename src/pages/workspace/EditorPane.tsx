import { CodeEditor } from '@/components/editor/CodeEditor'
import { HSplit } from '@/components/layout/HSplit'
import { Button, VerdictBadge } from '@/components/ui'
import type { LanguageOption, SubmissionView } from '@/types/api'
import { ConsolePanel } from './ConsolePanel'

/** Khung phải của FR-E1: chọn ngôn ngữ + nút chạy/nộp, editor, bảng điều khiển. */
export function EditorPane({
  languages,
  languageId,
  onLanguage,
  source,
  onSource,
  draftStatus,
  busy,
  error,
  onRun,
  onSubmit,
  consoleTab,
  onConsoleTab,
  customInput,
  onCustomInput,
  runResult,
  submission,
  practiceMode,
}: {
  languages: LanguageOption[]
  languageId: string
  onLanguage: (id: string) => void
  source: string
  onSource: (v: string) => void
  draftStatus: 'saved' | 'saving' | 'error'
  busy: 'run' | 'submit' | null
  error: string | null
  onRun: () => void
  onSubmit: () => void
  consoleTab: 'chay-thu' | 'ket-qua'
  onConsoleTab: (t: 'chay-thu' | 'ket-qua') => void
  customInput: string
  onCustomInput: (v: string) => void
  runResult: SubmissionView | null
  submission: SubmissionView | null
  practiceMode: boolean
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-2 py-1.5 dark:border-slate-700">
        <select
          aria-label="Ngôn ngữ"
          value={languageId}
          onChange={(e) => onLanguage(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
        >
          {languages.map((l) => (
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
          {/* FR-I6: chế độ luyện tập phải nói rõ, không để member tưởng còn tính điểm. */}
          {practiceMode ? (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Luyện tập — không tính BXH
            </span>
          ) : null}
          <Button onClick={onRun} disabled={busy !== null}>
            {busy === 'run' ? 'Đang chạy…' : 'Chạy thử'}
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={busy !== null}>
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
              onChange={onSource}
              languageId={languageId}
              onRun={onRun}
              onSubmit={onSubmit}
              ariaLabel="Ô soạn code"
            />
          }
          bottom={
            <ConsolePanel
              tab={consoleTab}
              onTab={onConsoleTab}
              customInput={customInput}
              onCustomInput={onCustomInput}
              runResult={runResult}
              submission={submission}
            />
          }
        />
      </div>
    </div>
  )
}
