/** Một contest trong danh sách mentor: pha, trạng thái, lối vào sửa/thống kê/nhân bản. */
import { useState } from 'react'
import { BarChart3, Copy, Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { PHASE_CLASS, PHASE_LABEL, contestPhase } from './contestPhase'
import { formatDateTime } from './mentorTime'
import type { MentorContestRow } from './mentorTypes'

export function ContestCard({
  row,
  cloning,
  onClone,
}: {
  row: MentorContestRow
  cloning: boolean
  onClone: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const phase = contestPhase(row.startAt, row.endAt)

  return (
    <li className="border border-line bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate font-display text-[16px] text-ink-1">{row.title}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs ${PHASE_CLASS[phase]}`}>{PHASE_LABEL[phase]}</span>
        <span
          className={` px-1.5 py-0.5 text-xs ${
            row.status === 'published'
              ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
              : 'bg-surface-sel text-ink-3'
          }`}
        >
          {row.status === 'published' ? 'Đã xuất bản' : 'Nháp'}
        </span>
      </div>

      <p className="mt-1 text-sm text-ink-5">
        {formatDateTime(row.startAt)} → {formatDateTime(row.endAt)} · {row.problemCount} bài ·{' '}
        {row.courseId ? 'theo khoá' : 'toàn câu lạc bộ'}
        {row.freezeMinutes > 0 ? ` · đóng băng ${row.freezeMinutes} phút cuối` : ''}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          to={`/mentor/contest/${row.id}`}
          className="inline-flex items-center gap-1.5 border border-line-strong px-3 py-1.5 text-sm font-medium hover:bg-surface-sel"
        >
          <Pencil size={14} /> Sửa &amp; chọn bài
        </Link>
        <Link
          to={`/mentor/contest/${row.id}/thong-ke`}
          className="inline-flex items-center gap-1.5 border border-line-strong px-3 py-1.5 text-sm font-medium hover:bg-surface-sel"
        >
          <BarChart3 size={14} /> Thống kê
        </Link>
        <Button onClick={() => setConfirming(true)} disabled={cloning}>
          <Copy size={14} /> Nhân bản
        </Button>
      </div>

      {confirming ? (
        <div role="status" className="mt-2 bg-surface-1 px-3 py-2 text-sm">
          {/* US-10 nói rõ bản sao để TRỐNG danh sách bài — nói trước thì mentor không
              mất công đi tìm 5 bài "biến đâu mất". */}
          <p>
            Bản sao giữ nguyên cấu hình, dời khung thời gian <b>+7 ngày</b> và ở trạng thái Nháp.{' '}
            <b>Danh sách bài để trống</b> để bạn chọn bài mới cho tuần sau (FR-I9).
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              variant="primary"
              disabled={cloning}
              onClick={() => {
                setConfirming(false)
                onClone()
              }}
            >
              {cloning ? 'Đang nhân bản…' : 'Nhân bản'}
            </Button>
            <Button onClick={() => setConfirming(false)}>Huỷ</Button>
          </div>
        </div>
      ) : null}
    </li>
  )
}
