/**
 * Khung NỘI DUNG của màn làm bài — phần đổi theo thanh icon (Đề bài · Bài nộp ·
 * Giáo trình · BXH · Trợ giúp) cộng dòng tiêu đề bài kề.
 *
 * Tách khỏi WorkspacePage vì đó là một vùng tự chứa: nó chỉ CHỌN panel để hiện theo
 * `rail`, không giữ trạng thái làm bài nào. Để nguyên trong page thì trang phình quá
 * trần 250 dòng — và cách đúng của hệ này là tách, không nới trần (xem eslint-rules).
 */
import { EmptyState, Spinner } from '@/components/ui'
import type { ProblemView, LanguageOption, SubmissionView } from '@/types/api'
import { ContestProblemList } from './ContestProblemList'
import { ContentHeader } from './ContentHeader'
import { HelpPanel } from './HelpPanel'
import { LeaderboardPanel } from './LeaderboardPanel'
import { LessonPanel } from './LessonPanel'
import { NoteBanner } from './NoteBanner'
import type { RailKey } from './rail'
import { StatementPanel } from './StatementPanel'
import { SubmissionsPanel } from './SubmissionsPanel'
import type { Siblings } from './siblings'
import { SyllabusPanel } from './SyllabusPanel'

export function ContentPanels({
  contentLabel,
  rail,
  siblings,
  dangCho,
  role,
  courseId,
  itemId,
  contestId,
  contestProblemId,
  laBaiDoc,
  problem,
  handleQuery,
  watchedId,
  languages,
  onSelectSubmission,
  onLoadIntoEditor,
}: {
  contentLabel: string
  rail: RailKey
  siblings: Siblings
  dangCho: boolean
  role: 'admin' | 'mentor' | 'member'
  courseId?: string
  itemId?: string
  contestId?: string
  contestProblemId?: string
  laBaiDoc: boolean
  problem: ProblemView | undefined
  handleQuery: string
  watchedId: string | null
  languages: LanguageOption[]
  onSelectSubmission: (id: string) => void
  onLoadIntoEditor: (s: SubmissionView) => void
}) {
  const onListRow = rail === 'de-bai' || rail === 'bai-nop'
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ContentHeader
        label={contentLabel}
        // Panel Đề bài tự mang <h1> (tên bài) — nhãn ở đây lùi về chữ thường để màn
        // hình chỉ có đúng MỘT tiêu đề cấp 1.
        asHeading={rail !== 'de-bai'}
        position={onListRow ? siblings.position : undefined}
        prev={onListRow ? siblings.prev : null}
        next={onListRow ? siblings.next : null}
      />

      {/* Ghi chú leader gửi cho mình (FR-J6) — bản vẽ đặt nó ở đúng màn này. */}
      <NoteBanner />

      <div className="min-h-0 flex-1 overflow-auto">
        {dangCho ? (
          <div className="p-4">
            <Spinner />
          </div>
        ) : null}
        {rail === 'tro-giup' ? <HelpPanel role={role} /> : null}
        {rail === 'giao-trinh' ? (
          courseId ? (
            <SyllabusPanel courseId={courseId} currentItemId={itemId} />
          ) : (
            <ContestProblemList contestId={contestId} currentId={contestProblemId} />
          )
        ) : null}
        {rail === 'bang-xep-hang' ? <LeaderboardPanel courseId={courseId} contestId={contestId} /> : null}
        {rail === 'de-bai' ? (
          laBaiDoc && itemId ? (
            <LessonPanel itemId={itemId} />
          ) : problem ? (
            <StatementPanel problem={problem} />
          ) : dangCho ? null : (
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
            languages={languages}
            onSelect={onSelectSubmission}
            onLoadIntoEditor={onLoadIntoEditor}
          />
        ) : null}
      </div>
    </div>
  )
}
