/**
 * Bảng xếp hạng contest — màn 05 của bản v2.
 *
 * Khác `LeaderboardPanel` (bản gọn trong thanh icon của workspace, chỉ đủ chỗ cho
 * hạng · tên · điểm) ở đúng một điểm quan trọng: bảng này có MỘT CỘT CHO MỖI BÀI.
 * Máy chủ vẫn luôn trả `problems` theo nhãn bài; bản trước chỉ không dùng tới, nên
 * mất hẳn cách nhìn "ai làm được bài nào" — thứ mà trong contest người ta nhìn nhiều
 * hơn cả tổng điểm.
 *
 * Ô của từng bài tô màu theo nghĩa cố định của hệ: moss = AC, earth = có nộp mà chưa
 * ăn trọn điểm, mực nhạt = chưa nộp.
 */
import { useQuery } from '@tanstack/react-query'
import { EmptyState, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import type { ContestStandingRow } from './standings'

/** Không có mục trong `row.problems` nghĩa là chưa nộp bài đó — không phải 0 điểm. */
function Cell({ cell }: { cell: { points: number; verdict: string } | undefined }) {
  if (!cell) {
    return <span className="num block text-right font-mono text-[12px] text-ink-6">—</span>
  }
  const tone = cell.verdict === 'AC' ? 'text-moss' : 'text-earth'
  return <span className={`num block text-right font-mono text-[12px] ${tone}`}>{Math.round(cell.points)}</span>
}

export function ContestStandings({
  contestId,
  problems,
}: {
  contestId: string
  /** Khoá trong `row.problems` là contestProblemId (UUID), KHÔNG phải nhãn — nên phải
   *  truyền cả cặp id/label vào đây thay vì chỉ danh sách nhãn. */
  problems: { id: string; label: string | null }[]
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['contest', contestId, 'standings'],
    queryFn: () => api.get<ContestStandingRow[]>(`/api/member/contests/${contestId}/standings`),
    refetchInterval: 5000,
  })

  if (isLoading) {
    return (
      <div className="p-4">
        <Spinner />
      </div>
    )
  }
  if (!data || data.length === 0) return <EmptyState title="Chưa ai có kết quả" />

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="sr-only">Bảng xếp hạng contest</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="w-9 px-2.5 py-2 text-left font-mono text-[11px] font-normal tracking-[0.14em] text-ink-6 uppercase">
              #
            </th>
            <th scope="col" className="px-2.5 py-2 text-left font-mono text-[11px] font-normal tracking-[0.14em] text-ink-6 uppercase">
              Thành viên
            </th>
            {problems.map((p, i) => (
              <th
                key={p.id}
                scope="col"
                className="w-12 px-2.5 py-2 text-right font-mono text-[11px] font-normal tracking-[0.14em] text-ink-6 uppercase"
              >
                {p.label ?? String.fromCharCode(65 + i)}
              </th>
            ))}
            <th scope="col" className="w-16 px-2.5 py-2 text-right font-mono text-[11px] font-normal tracking-[0.14em] text-ink-6 uppercase">
              Điểm
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.userId}
              className={`border-b border-line ${row.isMe ? 'bg-surface-sel shadow-[inset_2px_0_0_var(--moss)]' : ''}`}
            >
              <td className={`num px-2.5 py-2 font-mono text-[12px] ${row.isMe ? 'text-moss' : 'text-ink-5'}`}>
                {row.rank}
              </td>
              <td
                className={`max-w-0 truncate px-2.5 py-2 text-[13px] ${row.isMe ? 'font-semibold text-ink-1' : 'text-ink-2'}`}
              >
                {row.isMe ? 'Bạn' : row.displayName}
              </td>
              {problems.map((p) => (
                <td key={p.id} className="px-2.5 py-2">
                  <Cell cell={row.problems[p.id]} />
                </td>
              ))}
              <td className={`num px-2.5 py-2 text-right font-mono text-[12px] ${row.isMe ? 'text-ink-1' : 'text-ink-4'}`}>
                {Math.round(row.totalPoints)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
