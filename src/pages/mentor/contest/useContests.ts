/** Query + mutation của khu contest mentor (FR-I2/I7/I9). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ContestStats, MentorContestDetail, MentorContestRow } from '@/pages/mentor/mentorTypes'
import type { MentorCourseRow } from '@/pages/mentor/types'

const CONTESTS_KEY = ['mentor', 'contests'] as const

export function useContests() {
  return useQuery({
    queryKey: CONTESTS_KEY,
    queryFn: () => api.get<MentorContestRow[]>('/api/mentor/contests'),
  })
}

/** Dòng contest lấy từ danh sách — đủ cho những chỗ chỉ cần tiêu đề và mốc giờ. */
export function useContestRow(contestId: string) {
  const query = useContests()
  return { ...query, row: query.data?.find((c) => c.id === contestId) ?? null }
}

/**
 * Contest KÈM danh sách bài hiện tại.
 *
 * Route này vẫn luôn có ở server; SPA từng chú thích nhầm là "không có" rồi đi vòng
 * qua danh sách, khiến picker mở ra rỗng trong khi `PUT /:id/problems` thay thế cả
 * bộ — mở form rồi bấm lưu là gỡ sạch bài của contest.
 */
export function useContestDetail(contestId: string) {
  return useQuery({
    queryKey: ['mentor', 'contest', contestId],
    queryFn: () => api.get<MentorContestDetail>(`/api/mentor/contests/${contestId}`),
    enabled: Boolean(contestId),
  })
}

export function useMentorCourses() {
  return useQuery({
    queryKey: ['mentor', 'courses'],
    queryFn: () => api.get<MentorCourseRow[]>('/api/mentor/courses'),
  })
}

export function useContestStats(contestId: string) {
  return useQuery({
    queryKey: ['mentor', 'contest-stats', contestId],
    queryFn: () => api.get<ContestStats>(`/api/mentor/contests/${contestId}/stats`),
    enabled: Boolean(contestId),
  })
}

export interface ContestBody {
  title?: string
  descriptionMd?: string
  courseId?: string | null
  startAt?: string
  endAt?: string
  freezeMinutes?: number
  sequential?: boolean
}

export function useContestMutations() {
  const client = useQueryClient()
  const invalidate = () => client.invalidateQueries({ queryKey: CONTESTS_KEY })

  return {
    create: useMutation({
      mutationFn: (body: ContestBody) => api.post<{ id: string }>('/api/mentor/contests', body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: ContestBody }) =>
        api.patch<{ ok: true }>(`/api/mentor/contests/${id}`, body),
      onSuccess: invalidate,
    }),
    // Route clone không đọc body — gửi rỗng là đúng.
    clone: useMutation({
      mutationFn: (id: string) => api.post<{ id: string }>(`/api/mentor/contests/${id}/clone`),
      onSuccess: invalidate,
    }),
    publish: useMutation({
      // LUÔN gửi JSON: `parseBody` của server gọi `c.req.json()` và bắt lỗi thành
      // 400 "Body phải là JSON hợp lệ." nếu request không có body — POST trần sẽ
      // hỏng dù mọi thứ khác đúng.
      mutationFn: ({ id, confirm }: { id: string; confirm?: boolean }) =>
        api.post<{ ok: true }>(`/api/mentor/contests/${id}/publish`, confirm ? { confirm: true } : {}),
      onSuccess: invalidate,
    }),
    setProblems: useMutation({
      mutationFn: ({ id, problems }: { id: string; problems: { problemId: string; label: string; maxScore: number }[] }) =>
        api.put<{ count: number }>(`/api/mentor/contests/${id}/problems`, { problems }),
      onSuccess: invalidate,
    }),
  }
}
