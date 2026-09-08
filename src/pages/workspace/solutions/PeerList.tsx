/**
 * Bảng lời giải: tên · ngôn ngữ · thời gian · bộ nhớ · dung lượng. Bài của mình đứng đầu
 * bảng làm mốc (nền moss, cùng cách hệ đánh dấu "mình"), bấm một dòng khác để so.
 */
import { Avatar } from '@/components/ui/patterns'
import { cn } from '@/lib/cn'
import type { LanguageOption } from '@/types/api'
import { formatDuration, formatMemory } from '../format'
import { formatBytes, type PeerSolution } from './types'

export function PeerList({
  peers,
  mine,
  languages,
  onSelect,
}: {
  peers: PeerSolution[]
  mine: PeerSolution | null
  languages: LanguageOption[]
  onSelect: (id: string) => void
}) {
  const langName = (id: string) => languages.find((l) => l.id === id)?.name ?? id
  const rows = mine ? [mine, ...peers] : peers
  return (
    <table className="w-full table-fixed border-collapse text-[13px]">
      <caption className="sr-only">Lời giải của mọi người</caption>
      <colgroup>
        <col />
        <col className="w-20" />
        <col className="w-16" />
        <col className="w-20" />
        <col className="w-16" />
      </colgroup>
      <thead>
        <tr className="border-b border-line text-left font-mono text-[11px] tracking-[0.12em] text-(--label) uppercase">
          <th className="py-1.5 font-normal">Người</th>
          <th className="py-1.5 font-normal">Ngôn ngữ</th>
          <th className="py-1.5 text-right font-normal">Thời gian</th>
          <th className="py-1.5 text-right font-normal">Bộ nhớ</th>
          <th className="py-1.5 text-right font-normal">Cỡ</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr
            key={p.id}
            className={cn(
              'border-b border-line',
              p.isMine ? 'bg-primary-soft shadow-[inset_2px_0_0_var(--moss)]' : 'cursor-pointer hover:bg-surface-sel',
            )}
            onClick={p.isMine ? undefined : () => onSelect(p.id)}
          >
            <td className="max-w-0 truncate py-2 pr-2">
              {p.isMine ? (
                <span className="font-semibold text-ink-1">Bạn</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className="flex max-w-full items-center gap-2 text-left text-ink-2 hover:underline"
                >
                  <Avatar name={p.authorName} src={p.avatarUrl} size={20} />
                  <span className="truncate">{p.authorName}</span>
                </button>
              )}
            </td>
            <td className="truncate py-2 font-mono text-[12px] text-ink-4">{langName(p.languageId)}</td>
            <td className="num py-2 text-right font-mono text-ink-3">{formatDuration(p.timeMsMax)}</td>
            <td className="num py-2 text-right font-mono text-ink-3">{formatMemory(p.memoryKbMax)}</td>
            <td className="num py-2 text-right font-mono text-ink-5">{formatBytes(p.sourceBytes)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
