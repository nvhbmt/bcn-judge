/**
 * Bảng xếp hạng các team trong cùng khoá — cột phải của màn 06.
 *
 * MỘT phạm vi duy nhất: mọi team, cộng trên mọi khoá. Bản trước chia hai nhánh (trong
 * khoá của team / toàn CLB) và phải in nhãn nói đang dùng nhánh nào — một bảng mà ý
 * nghĩa con số đổi theo hoàn cảnh thì phải đọc nhãn trước mỗi lần nhìn.
 *
 * Điểm do server tính bằng ĐÚNG công thức của BXH khoá, nên con số ở đây và ở trang
 * chủ nói cùng một chuyện. Thứ tự cũng vậy: SỐ BÀI AC trước, rồi tổng điểm (§2.7).
 *
 * Vì thế có lúc team ít điểm hơn lại xếp trên — Beta 13 bài/1440đ đứng trên Alpha
 * 12 bài/1470đ. Trông như lỗi nếu chỉ hiện một con số, nên bảng hiện CẢ HAI: người
 * đọc thấy ngay vì sao. Giấu bớt một cột là biến một quy tắc thành một điều bí ẩn.
 */
import { useQuery } from '@tanstack/react-query'
import { EmptyState, Spinner } from '@/components/ui'
import { api } from '@/lib/api'

interface TeamStandingRow {
  rank: number
  id: string
  name: string
  acCount: number
  totalPoints: number
  memberCount: number
  isMine: boolean
}

interface TeamStandings {
  rows: TeamStandingRow[]
}

const TH = 'px-2.5 py-2 font-mono text-[11px] font-normal tracking-[0.14em] whitespace-nowrap text-ink-6 uppercase'

export function TeamStandings() {
  const { data, isLoading } = useQuery({
    queryKey: ['team', 'standings'],
    queryFn: () => api.get<TeamStandingRow[]>('/api/member/teams/standings'),
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="p-4">
        <Spinner />
      </div>
    )
  }

  if (!data || data.length === 0) return <EmptyState title="Chưa có team nào để xếp hạng" />

  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">Xếp hạng các team trong câu lạc bộ</caption>
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className={`w-9 text-left ${TH}`}>
            #
          </th>
          <th scope="col" className={`text-left ${TH}`}>
            Team
          </th>
          <th scope="col" className={`w-16 text-right ${TH}`}>
            Bài AC
          </th>
          <th scope="col" className={`w-16 text-right ${TH}`}>
            Điểm
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr
            key={row.id}
            className={`border-b border-line ${row.isMine ? 'bg-surface-sel shadow-[inset_2px_0_0_var(--moss)]' : ''}`}
          >
            <td className={`num px-2.5 py-2 font-mono text-[12px] ${row.isMine ? 'text-moss' : 'text-ink-5'}`}>
              {row.rank}
            </td>
            <td
              title={row.name}
              className={`max-w-0 truncate px-2.5 py-2 text-[13px] ${row.isMine ? 'font-semibold text-ink-1' : 'text-ink-2'}`}
            >
              {row.name}
              {/* Tổng điểm chứ không phải trung bình, nên số người phải hiện: team
                  đông hơn thì tổng cao hơn, giấu đi là để bảng nói dối một nửa. */}
              <span className="num ml-1.5 font-mono text-[11px] text-ink-6">{row.memberCount} người</span>
            </td>
            <td className="num px-2.5 py-2 text-right font-mono text-[12px] text-ink-3">{row.acCount}</td>
            <td className={`num px-2.5 py-2 text-right font-mono text-[12px] ${row.isMine ? 'text-ink-1' : 'text-ink-4'}`}>
              {row.totalPoints}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
