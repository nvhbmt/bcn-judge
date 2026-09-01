/**
 * Bài kề trước/sau của bài đang mở, cho dòng tiêu đề khung nội dung (màn 04).
 *
 * Đọc lại đúng hai endpoint mà các panel khác đã gọi (giáo trình khoá, hoặc danh sách
 * bài contest) nên `queryKey` trùng và react-query dùng chung cache — mở màn làm bài
 * không tốn thêm một vòng mạng nào.
 *
 * Chỉ tính trên các mục KIND = 'problem': bài đọc nằm xen giữa nhưng "bài trước / bài
 * sau" phải nhảy giữa các BÀI, không dừng ở một trang lý thuyết.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SiblingLink } from './ContentHeader'
import type { SyllabusSection } from './SyllabusPanel'

interface ContestDetail {
  problems: { id: string; label: string | null; title: string }[]
}

export interface Siblings {
  position: string | undefined
  prev: SiblingLink | null
  next: SiblingLink | null
}

const EMPTY: Siblings = { position: undefined, prev: null, next: null }

function around<T>(list: T[], i: number): { prev: T | null; next: T | null } {
  return { prev: i > 0 ? (list[i - 1] ?? null) : null, next: i >= 0 ? (list[i + 1] ?? null) : null }
}

export function useSiblings(params: {
  courseId?: string
  itemId?: string
  contestId?: string
  contestProblemId?: string
}): Siblings {
  const { courseId, itemId, contestId, contestProblemId } = params

  const { data: sections } = useQuery({
    queryKey: ['syllabus', courseId],
    queryFn: () => api.get<SyllabusSection[]>(`/api/member/courses/${courseId}/syllabus`),
    enabled: Boolean(courseId),
  })
  const { data: contest } = useQuery({
    queryKey: ['contest', contestId],
    queryFn: () => api.get<ContestDetail>(`/api/member/contests/${contestId}`),
    enabled: Boolean(contestId) && !courseId,
  })

  if (courseId && itemId && sections) {
    const flat = sections.flatMap((s) => s.items.filter((i) => i.kind === 'problem').map((i) => ({ ...i, section: s })))
    const i = flat.findIndex((x) => x.id === itemId)
    if (i === -1) return EMPTY
    const { prev, next } = around(flat, i)
    const to = (x: (typeof flat)[number]) => ({ href: `/khoa-hoc/${courseId}/bai/${x.id}`, title: x.title })
    return {
      position: `bài ${i + 1}/${flat.length} · ${flat[i]!.section.title}`,
      prev: prev ? to(prev) : null,
      next: next ? to(next) : null,
    }
  }

  if (contestId && contestProblemId && contest) {
    const list = contest.problems
    const i = list.findIndex((x) => x.id === contestProblemId)
    if (i === -1) return EMPTY
    const { prev, next } = around(list, i)
    const to = (x: (typeof list)[number]) => ({ href: `/contest/${contestId}/bai/${x.id}`, title: x.title })
    return {
      position: `bài ${i + 1}/${list.length}`,
      prev: prev ? to(prev) : null,
      next: next ? to(next) : null,
    }
  }

  return EMPTY
}
