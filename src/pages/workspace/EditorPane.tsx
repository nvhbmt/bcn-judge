import { CodeEditor } from '@/components/editor/CodeEditor'
import { HSplit } from '@/components/layout/HSplit'
import { Button, VerdictBadge } from '@/components/ui'
import { KeyHint } from '@/components/ui/patterns'
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
  draftSavedAt,
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
  draftSavedAt: number | null
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
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-2 py-1.5">
        <select
          aria-label="Ngôn ngữ"
          value={languageId}
          onChange={(e) => onLanguage(e.target.value)}
          className="border border-line-strong px-2 py-1 font-mono text-xs"
        >
          {languages.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} {l.versionLabel ?? ''}
            </option>
          ))}
        </select>

        {submission ? <VerdictBadge verdict={submission.verdict} pending={submission.status !== 'done'} /> : null}
        {/* Bản vẽ ghi "nháp đã lưu 14:41" — có GIỜ chứ không chỉ "đã lưu". Đó đúng là
            thứ người gõ cần biết trước khi đóng tab. */}
        <span className="font-mono text-[11px] text-ink-6" aria-live="polite">
          {draftStatus === 'saving'
            ? 'đang lưu nháp…'
            : draftStatus === 'error'
              ? 'không lưu được nháp'
              : draftSavedAt
                ? `nháp đã lưu ${new Date(draftSavedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                : ''}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* FR-I6: chế độ luyện tập phải nói rõ, không để member tưởng còn tính điểm. */}
          {practiceMode ? (
            <span className="bg-[var(--tint-earth)] px-2 py-0.5 text-xs text-earth">
              Luyện tập — không tính BXH
            </span>
          ) : null}
          {/* Chip phím tắt theo bản vẽ. Hai tổ hợp này CÓ THẬT (FR-E8, đăng ký ở
              CodeEditor), nên nói ra là đúng — khác ô "⌘K tìm bài" của bản vẽ mà app
              chưa có nên không vẽ. Ẩn ở khung hẹp: chỗ đó đã chật. */}
          <span className="hidden xl:flex xl:items-center xl:gap-1.5">
            <KeyHint>⌘↵ chạy thử</KeyHint>
            <KeyHint>⇧⌘↵ nộp</KeyHint>
          </span>
          <Button onClick={onRun} disabled={busy !== null}>
            {busy === 'run' ? 'Đang chạy…' : 'Chạy thử'}
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={busy !== null}>
            {busy === 'submit' ? 'Đang nộp…' : 'Nộp bài'}
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="shrink-0 bg-[var(--tint-clay)] px-3 py-1.5 text-xs text-[var(--color-wa)]">
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
