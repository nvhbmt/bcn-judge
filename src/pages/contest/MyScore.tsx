/**
 * Dải "Điểm của bạn" ở màn contest (màn 05).
 *
 * Bốn con số mà thí sinh liếc nhiều nhất: tổng điểm, hạng, số bài AC, số lần nộp.
 * Cả bốn đọc từ CHÍNH dòng của mình trong bảng xếp hạng, không tính lại ở client —
 * tính lại là mở đường cho hai con số khác nhau cho cùng một sự thật, và trong contest
 * thì đó là thứ người ta khiếu nại.
 *
 * Không có dòng của mình (chưa nộp bài nào) thì không hiện gì: một dải toàn số 0 chỉ
 * chiếm chỗ chứ không nói thêm điều gì mà màn hình chưa nói.
 */
import { useQuery } from '@tanstack/react-query'
import { StatStrip } from '@/components/ui/patterns'
import { api } from '@/lib/api'
import { attemptsOf, type ContestStandingRow } from './standings'

export function MyScore({ contestId }: { contestId: string }) {
  const { data } = useQuery({
    queryKey: ['contest', contestId, 'standings'],
    queryFn: () => api.get<ContestStandingRow[]>(`/api/member/contests/${contestId}/standings`),
    refetchInterval: 5000,
  })

  const me = data?.find((r) => r.isMe)
  if (!me) return null

  return (
    <StatStrip
      items={[
        { label: 'Tổng điểm', value: Math.round(me.totalPoints), tone: 'moss' },
        { label: 'Hạng', value: me.rank },
        { label: 'Bài AC', value: me.acCount },
        { label: 'Lần nộp', value: attemptsOf(me) },
      ]}
    />
  )
}
