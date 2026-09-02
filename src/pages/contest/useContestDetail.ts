/**
 * Nguồn DUY NHẤT cho `GET /api/member/contests/:id`.
 *
 * Trước đây ba nơi tự gọi endpoint này dưới cùng `queryKey: ['contest', id]`, nhưng
 * hai nơi dùng `api.get` (đã bóc envelope) còn một nơi dùng `api.getWithMeta` (còn
 * nguyên `{data, meta}`). React Query chỉ giữ MỘT ô cache cho mỗi key, nên ô đó chứa
 * hình dạng của bên nào ghi trước — và bên kia đọc ra một object vẫn "truthy" nhưng
 * thiếu đúng những trường nó cần.
 *
 * Triệu chứng thật: đi từ trang contest (ghi cả phong bì) rồi bấm vào một bài thì
 * `contest.problems` là `undefined` và `useSiblings` ném TypeError, giết cả màn làm
 * bài. Vào thẳng bằng URL nguội thì không sao — lỗi phụ thuộc thứ tự điều hướng, nên
 * nó sống sót qua e2e (bộ test dừng ở trang chi tiết, không bấm vào bài).
 *
 * Vì vậy cả ba đi chung một hook: một kiểu, một cách gọi, một ô cache. Cần thêm
 * trường thì thêm vào `ContestDetail` ở đây, đừng khai lại một interface cục bộ.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type ContestPhase = 'sap-dien-ra' | 'dang-dien-ra' | 'da-ket-thuc'

export interface ContestProblemSummary {
  id: string
  label: string | null
  position: number
  title: string
  maxScore: number
}

export interface ContestDetail {
  id: string
  title: string
  descriptionMd: string | null
  startAt: string
  endAt: string
  phase: ContestPhase
  freezeMinutes: number
  problemCount: number
  problems: ContestProblemSummary[]
}

export function useContestDetail(
  contestId: string | undefined,
  options: { refetchInterval?: number } = {},
) {
  const query = useQuery({
    queryKey: ['contest', contestId],
    queryFn: () => api.getWithMeta<ContestDetail>(`/api/member/contests/${contestId}`),
    enabled: Boolean(contestId),
    ...(options.refetchInterval === undefined ? {} : { refetchInterval: options.refetchInterval }),
  })
  return {
    contest: query.data?.data,
    meta: query.data?.meta,
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}
