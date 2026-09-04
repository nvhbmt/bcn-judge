import { useQuery } from '@tanstack/react-query'
import { EmptyState, Spinner, VerdictBadge } from '@/components/ui'
import { api } from '@/lib/api'
import type { LanguageOption, SubmissionView } from '@/types/api'
import { formatDuration, formatMemory } from './format'
import { cn } from '@/lib/cn'

/**
 * Tab "Bài nộp" (FR-E3/FR-G1): danh sách lượt nộp với verdict, ngôn ngữ, thời gian,
 * bộ nhớ và điểm. Chi tiết TỪNG TESTCASE vẫn nằm ở tab Kết quả dưới editor (FR-E5).
 *
 * Vì sao hiện đủ bốn cột thay vì mỗi verdict: dữ liệu đã nằm sẵn trong cùng một lượt
 * gọi API (`timeMsMax`, `memoryKbMax` có trong danh sách, không phải xin thêm), mà
 * đó đúng là thứ người học so giữa các lần nộp — "bản vừa rồi nhanh hơn bản trước
 * bao nhiêu". Giấu đi thì họ phải bấm vào từng lượt mới thấy, hoặc tự nhớ.
 *
 * Số liệu là của lượt nộp ĐÃ CHẤM XONG. Bài chưa chấm hoặc lỗi biên dịch thì không
 * có thời gian/bộ nhớ để nói, và ô đó ghi "—" chứ không ghi 0: 0 ms là một phép đo,
 * còn "không có" là chuyện khác hẳn.
 */
export function SubmissionsPanel({
  handleQuery,
  selectedId,
  languages,
  onSelect,
  onLoadIntoEditor,
}: {
  handleQuery: string
  selectedId: string | null
  /** Để đổi `c11` thành "C" — mã ngôn ngữ là chuyện nội bộ, không phải thứ để đọc. */
  languages: LanguageOption[]
  onSelect: (id: string) => void
  onLoadIntoEditor: (submission: SubmissionView) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['submissions', handleQuery],
    queryFn: () => api.get<SubmissionView[]>(`/api/member/submissions?${handleQuery}`),
    refetchInterval: 5000,
  })

  if (isLoading) return <div className="p-4"><Spinner /></div>
  if (!data || data.length === 0) {
    return <EmptyState title="Chưa nộp bài nào" hint="Bài nộp của bạn sẽ hiện ở đây." />
  }

  const nameOf = (id: string) => languages.find((l) => l.id === id)?.name ?? id

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-136 border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left font-mono text-[11px] tracking-widest text-(--label) uppercase">
            <th scope="col" className="px-4 py-2 font-medium">Kết quả</th>
            <th scope="col" className="px-2 py-2 font-medium">Ngôn ngữ</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Thời gian</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Bộ nhớ</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Điểm</th>
            <th scope="col" className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.map((s) => (
            <tr
              key={s.id}
              className={cn('relative', s.id === selectedId ? 'bg-primary-soft' : 'hover:bg-surface-sel')}
            >
              {/* CẢ HÀNG là vùng bấm, không chỉ ô đầu: `after:absolute after:inset-0`
                  kéo vùng nhấn của nút trải kín hàng (hàng đã `relative`). Vẫn là MỘT
                  <button> thật nên bàn phím và trình đọc màn hình không đổi gì — khác
                  hẳn cách gắn onClick lên <tr>, vì <tr> không nhận được tiêu điểm. */}
              <td className="px-4 py-2">
                <button
                  onClick={() => onSelect(s.id)}
                  className="flex flex-col items-start gap-1 text-left after:absolute after:inset-0 after:content-['']"
                >
                  <VerdictBadge tone="soft" verdict={s.verdict} pending={s.status !== 'done'} />
                  <span className="num font-mono text-[11px] text-ink-6">{formatTime(s.receivedAt)}</span>
                </button>
              </td>
              <td className="px-2 py-2">
                <span className="bg-surface-sel px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-ink-4">
                  {nameOf(s.languageId)}
                </span>
              </td>
              <td className="num px-2 py-2 text-right font-mono text-[13px] whitespace-nowrap text-ink-3">
                {formatDuration(s.timeMsMax)}
              </td>
              <td className="num px-2 py-2 text-right font-mono text-[13px] whitespace-nowrap text-ink-3">
                {formatMemory(s.memoryKbMax)}
              </td>
              <td className="num px-2 py-2 text-right font-mono text-[13px] whitespace-nowrap text-ink-3">
                {s.score === null ? '—' : `${s.score}đ`}
              </td>
              {/* `relative z-10` để nút này nổi TRÊN vùng phủ của nút chọn hàng —
                  không thì bấm "Nạp lại code" lại thành chọn hàng. */}
              <td className="relative z-10 px-4 py-2 text-right">
                <button
                  onClick={async () =>
                    onLoadIntoEditor(await api.get<SubmissionView>(`/api/member/submissions/${s.id}`))
                  }
                  className="text-[13px] whitespace-nowrap text-primary hover:underline"
                >
                  Nạp lại code
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}
