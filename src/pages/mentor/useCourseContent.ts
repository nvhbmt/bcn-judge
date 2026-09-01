/** Query + mutation của màn soạn nội dung khoá (FR-C1/C3). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SyllabusSection } from './mentorTypes'
import type { MentorProblemRow } from './types'

export function syllabusKey(courseId: string) {
  return ['mentor', 'syllabus', courseId] as const
}

export function useSyllabus(courseId: string) {
  return useQuery({
    queryKey: syllabusKey(courseId),
    queryFn: () => api.get<SyllabusSection[]>(`/api/mentor/courses/${courseId}/syllabus`),
    enabled: Boolean(courseId),
  })
}

export function useMentorProblems() {
  return useQuery({
    queryKey: ['mentor', 'problems'],
    queryFn: () => api.get<MentorProblemRow[]>('/api/mentor/problems'),
  })
}

/**
 * Union chứ không phải `{kind, problemId?}`: server bắt buộc XOR — bài đọc KHÔNG
 * được kèm problemId, mục bài tập BẮT BUỘC có. Diễn đạt bằng type để lỗi lộ ra
 * lúc biên dịch thay vì thành 400 lúc mentor bấm Lưu.
 */
export type NewItemBody =
  | { sectionId: string; kind: 'lesson'; title: string; lessonBodyMd?: string }
  | { sectionId: string; kind: 'problem'; title: string; problemId: string }

export interface PatchItemBody {
  title?: string
  lessonBodyMd?: string
  status?: 'draft' | 'published'
  confirm?: boolean
}

export interface OrderPayload {
  sections?: { id: string; position: number }[]
  items?: { id: string; sectionId: string; position: number }[]
}

export function useContentMutations(courseId: string) {
  const client = useQueryClient()
  const base = `/api/mentor/courses/${courseId}`
  const invalidate = () => client.invalidateQueries({ queryKey: syllabusKey(courseId) })

  return {
    createSection: useMutation({
      mutationFn: (title: string) => api.post<{ id: string }>(`${base}/sections`, { title }),
      onSuccess: invalidate,
    }),
    reorder: useMutation({
      mutationFn: (body: OrderPayload) => api.put<{ ok: true }>(`${base}/order`, body),
      onSuccess: invalidate,
    }),
  }
}

/** Gọi trong TỪNG chương: lỗi "thiếu problemId" phải hiện ngay dưới form đang mở,
 *  không phải dưới chương khác. */
export function useCreateItem(courseId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: NewItemBody) => api.post<{ id: string }>(`/api/mentor/courses/${courseId}/items`, body),
    onSuccess: () => client.invalidateQueries({ queryKey: syllabusKey(courseId) }),
  })
}

/** Gọi MỘT lần cho MỖI mục: mỗi dòng cần trạng thái lỗi/pending riêng, dùng chung
 *  một mutation thì cảnh báo của mục này hiện dưới mục kia. */
export function useItemMutations(courseId: string) {
  const client = useQueryClient()
  const base = `/api/mentor/courses/${courseId}/items`
  const invalidate = () => client.invalidateQueries({ queryKey: syllabusKey(courseId) })

  return {
    save: useMutation({
      mutationFn: ({ itemId, body }: { itemId: string; body: PatchItemBody }) =>
        api.patch<{ id: string }>(`${base}/${itemId}`, body),
      onSuccess: invalidate,
    }),
    publish: useMutation({
      mutationFn: ({ itemId, confirm }: { itemId: string; confirm?: boolean }) =>
        api.patch<{ id: string }>(`${base}/${itemId}`, { status: 'published', ...(confirm ? { confirm: true } : {}) }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (itemId: string) => api.del<{ ok: true }>(`${base}/${itemId}`),
      onSuccess: invalidate,
    }),
  }
}

/**
 * Đổi chỗ hai phần tử kề nhau. Trả null khi ra ngoài mảng — `noUncheckedIndexedAccess`
 * biến truy cập ngoài biên thành `undefined`, kiểm ở đây một lần cho gọn.
 */
export function swapped<T>(list: T[], index: number, delta: number): T[] | null {
  const a = list[index]
  const b = list[index + delta]
  if (!a || !b) return null
  const next = [...list]
  next[index] = b
  next[index + delta] = a
  return next
}

/** Đánh số lại 1..n toàn danh sách thay vì chỉ hoán vị hai `position`: dữ liệu cũ
 *  có thể trùng/hổng số, gửi cả dải là cách chắc chắn nhất để thứ tự hiển thị
 *  khớp thứ tự đã lưu. */
export function sectionOrder(sections: { id: string }[]): OrderPayload {
  return { sections: sections.map((s, i) => ({ id: s.id, position: i + 1 })) }
}

export function itemOrder(sectionId: string, items: { id: string }[]): OrderPayload {
  return { items: items.map((it, i) => ({ id: it.id, sectionId, position: i + 1 })) }
}
