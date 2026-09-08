/**
 * So sánh hai lời giải: bài của mình bên trái, bài đang chọn bên phải; mỗi cột một dòng
 * số đo. Dưới 900 px xếp dọc. Mã tô màu bằng `highlightCode` — cùng bảng màu hljs với
 * khối code trong đề và màn bài nộp của mentor, không phải một bộ màu riêng.
 *
 * Không diff màu: hai lời giải khác nhau từ đầu, một diff dòng-với-dòng chỉ tô đỏ cả
 * hai cột. Đặt cạnh nhau với số đo trên đầu là câu trả lời cho "họ làm khác gì".
 */
import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { highlightCode } from '@/components/markdown/render'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { LanguageOption } from '@/types/api'
import { formatDuration, formatMemory } from '../format'
import { formatBytes, type PeerSolution } from './types'

function SourceBlock({
  who,
  solution,
  languages,
  mine,
}: {
  who: string
  solution: PeerSolution | null
  languages: LanguageOption[]
  mine: boolean
}) {
  const mode = languages.find((l) => l.id === solution?.languageId)?.cmMode ?? null
  const html = useMemo(() => (solution?.source ? highlightCode(solution.source, mode) : null), [solution?.source, mode])
  return (
    <section className={cn('flex min-h-0 flex-col border', mine ? 'border-moss' : 'border-line-strong')}>
      <header className={cn('border-b px-3 py-2', mine ? 'border-moss bg-primary-soft' : 'border-line bg-surface-2')}>
        <p className={cn('truncate text-[14px] font-semibold', mine ? 'text-ink-1' : 'text-ink-2')}>{who}</p>
        {solution ? (
          <p className="num mt-0.5 font-mono text-[12px] text-ink-5">
            {languages.find((l) => l.id === solution.languageId)?.name ?? solution.languageId} ·{' '}
            {formatDuration(solution.timeMsMax)} · {formatMemory(solution.memoryKbMax)} · {formatBytes(solution.sourceBytes)}
          </p>
        ) : null}
      </header>
      {html ? (
        <div
          className="markdown-body min-h-0 flex-1 overflow-auto bg-surface-editor px-3 py-2 text-[12.5px]"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="px-3 py-6 text-center font-mono text-[12px] text-ink-5">Chưa có bài AC nào của bạn để so.</p>
      )}
    </section>
  )
}

export function CompareView({
  mine,
  peer,
  languages,
  onBack,
}: {
  mine: PeerSolution | null
  peer: PeerSolution
  languages: LanguageOption[]
  onBack: () => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={onBack}>
          <ArrowLeft size={14} /> Danh sách
        </Button>
        <span className="font-mono text-[12px] text-ink-5">So sánh với {peer.authorName}</span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        <SourceBlock who="Bạn" solution={mine} languages={languages} mine />
        <SourceBlock who={peer.authorName} solution={peer} languages={languages} mine={false} />
      </div>
    </div>
  )
}
