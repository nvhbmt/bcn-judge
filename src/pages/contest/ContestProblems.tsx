/**
 * Danh sách bài trong contest (màn 05).
 *
 * Mỗi dòng nói điểm ĐANG CÓ trên điểm tối đa (`88/150`) chứ không chỉ nói điểm tối
 * đa: trong contest, thứ thí sinh cần biết là còn bao nhiêu điểm chưa lấy được ở bài
 * nào — nhìn xong là biết nên quay lại bài nào trước.
 *
 * Số đó lấy từ dòng của chính mình trong bảng xếp hạng, cùng một nguồn với dải "Điểm
 * của bạn", để hai chỗ không bao giờ nói hai con số khác nhau.
 *
 * Cột cuối tô ĐỎ khi chưa nộp, XANH khi đã nộp: giữa contest, câu hỏi đầu tiên là
 * "còn bài nào mình chưa đụng tới", và một cột xám đều thì phải đọc từng chữ mới
 * trả lời được.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Row, RowGroup } from '@/components/ui/patterns'
import { api } from '@/lib/api'
import type { ContestStandingRow } from './standings'
import { cn } from '@/lib/cn'

interface ContestProblem {
  id: string
  label: string | null
  title: string
  maxScore: number
}

export function ContestProblems({
  contestId,
  problems,
}: {
  contestId: string
  problems: ContestProblem[]
}) {
  const { data } = useQuery({
    queryKey: ['contest', contestId, 'standings'],
    queryFn: () => api.get<ContestStandingRow[]>(`/api/member/contests/${contestId}/standings`),
    refetchInterval: 5000,
  })
  const me = data?.find((r) => r.isMe)


  return (
    <RowGroup>
      {problems.map((p, i) => {
        const mine = me?.problems[p.id]
        const done = mine?.verdict === 'AC'
        return (
          <Row key={p.id} accent={done ? 'moss' : null} interactive={!done} className="gap-3.5">
            <span className={cn('num w-6 shrink-0 font-mono text-[14px]', done ? 'text-moss' : 'text-ink-5')}>
              {p.label ?? String.fromCharCode(65 + i)}
            </span>

            <Link
              to={`/contest/${contestId}/bai/${p.id}`}
              className={cn(
                'min-w-0 flex-1 truncate text-[16px] hover:underline',
                done ? 'font-semibold text-ink-1' : 'text-ink-3',
              )}
            >
              {p.title}
            </Link>

            <span className="num shrink-0 font-mono text-[14px] text-ink-4">
              <span className={done ? 'text-moss' : mine ? 'text-earth' : 'text-ink-6'}>
                {mine ? Math.round(mine.points) : 0}
              </span>
              /{p.maxScore}
            </span>

            {/* Cột này trả lời ĐÚNG MỘT câu: đã đụng bài này chưa. Đỏ = chưa, xanh
                = rồi — trong contest đó là thứ người ta quét mắt tìm trước tiên.
                Nó KHÔNG nói bài đã đúng hay chưa; điểm ở cột bên trái nói việc đó
                (moss khi AC, earth khi có nộp mà chưa trọn điểm). Hai cột trả lời
                hai câu khác nhau, nên "3 lần" xanh cạnh "0/100" earth là đọc được:
                đã làm, chưa ăn điểm. */}
            <span
              className={cn(
                'num w-20 shrink-0 text-right font-mono text-[12px]',
                mine ? 'text-moss' : 'text-wa',
              )}
            >
              {mine ? `${mine.attempts} lần` : 'chưa nộp'}
            </span>
          </Row>
        )
      })}
    </RowGroup>
  )
}
