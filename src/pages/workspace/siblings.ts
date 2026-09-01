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
  /**
   * Loại của mục đang mở, đọc từ chính giáo trình đã nạp.
   *
   * `undefined` khi chưa biết (giáo trình chưa về, hoặc đang ở đường contest — contest
   * không có bài đọc). Nhờ lấy ở đây mà màn làm bài phân biệt được bài đọc với bài tập
   * mà KHÔNG tốn thêm vòng mạng nào: react-query dùng chung cache với panel Giáo trình.
   */
  kind: 'lesson' | 'problem' | undefined
  /**
   * Đã có CÂU TRẢ LỜI về `kind` hay chưa — kể cả câu trả lời là "không biết".
   *
   * Phân biệt "chưa hỏi xong" với "hỏi xong mà không thấy mục này" là điều bắt buộc:
   * màn làm bài chỉ được gọi endpoint bài tập sau khi chắc mục không phải bài đọc, mà
   * nếu chờ mãi một `kind` không bao giờ tới (giáo trình lỗi, hoặc mục không nằm trong
   * giáo trình) thì màn hình quay vòng mãi thay vì báo không mở được.
   */
  resolved: boolean
}

const EMPTY: Siblings = { position: undefined, prev: null, next: null, kind: undefined, resolved: false }

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

  const { data: sections, isFetched: syllabusFetched } = useQuery({
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
    // Loại của mục tra trên TOÀN BỘ danh sách, không phải trên `flat` (chỉ có bài tập):
    // một bài đọc không nằm trong `flat` nên nếu tra ở đó thì mọi bài đọc đều ra
    // undefined — đúng cái mà nhánh này cần phân biệt.
    const kind = sections.flatMap((s) => s.items).find((x) => x.id === itemId)?.kind

    const href = (id: string) => `/khoa-hoc/${courseId}/bai/${id}`

    // Đang mở một BÀI ĐỌC: đi tiếp theo TOÀN BỘ mục, vì thứ nằm ngay sau một trang lý
    // thuyết thường chính là bài tập áp dụng nó. Bỏ qua như nhánh dưới thì đọc xong là
    // mắc kẹt, không có đường đi tiếp ngoài việc quay lại danh sách.
    if (kind === 'lesson') {
      const all = sections.flatMap((s) => s.items)
      const j = all.findIndex((x) => x.id === itemId)
      const { prev, next } = around(all, j)
      const to = (x: (typeof all)[number]) => ({ href: href(x.id), title: x.title })
      return {
        position: undefined,
        prev: prev ? to(prev) : null,
        next: next ? to(next) : null,
        kind,
        resolved: true,
      }
    }

    const flat = sections.flatMap((s) => s.items.filter((i) => i.kind === 'problem').map((i) => ({ ...i, section: s })))
    const i = flat.findIndex((x) => x.id === itemId)
    if (i === -1) return { ...EMPTY, kind, resolved: true }
    const { prev, next } = around(flat, i)
    const to = (x: (typeof flat)[number]) => ({ href: `/khoa-hoc/${courseId}/bai/${x.id}`, title: x.title })
    return {
      position: `bài ${i + 1}/${flat.length} · ${flat[i]!.section.title}`,
      prev: prev ? to(prev) : null,
      next: next ? to(next) : null,
      kind,
      resolved: true,
    }
  }

  // Contest không có mục bài đọc, nên biết ngay mà không cần chờ danh sách bài.
  if (contestProblemId) {
    if (!contest) return { ...EMPTY, kind: 'problem', resolved: true }
  }

  if (contestId && contestProblemId && contest) {
    const list = contest.problems
    const i = list.findIndex((x) => x.id === contestProblemId)
    if (i === -1) return { ...EMPTY, kind: 'problem', resolved: true }
    const { prev, next } = around(list, i)
    const to = (x: (typeof list)[number]) => ({ href: `/contest/${contestId}/bai/${x.id}`, title: x.title })
    return {
      position: `bài ${i + 1}/${list.length}`,
      prev: prev ? to(prev) : null,
      next: next ? to(next) : null,
      kind: 'problem',
      resolved: true,
    }
  }

  // Giáo trình đã hỏi xong mà không dựng được kết quả (lỗi tải, hoặc mục không thuộc
  // khoá này): coi như đã có câu trả lời, để phía gọi thôi chờ và đi tiếp.
  return { ...EMPTY, resolved: Boolean(courseId) && syllabusFetched }
}
