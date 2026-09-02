/**
 * Ba danh sách của cụm quản trị, và cách lấy MỘT bản ghi ra khỏi chúng.
 *
 * Server không có route đọc từng bản ghi (`GET /api/admin/courses/:id`, `.../teams/:id`,
 * `.../languages/:id` đều không tồn tại) — chỉ có danh sách. Nên trang sửa lấy bản ghi
 * ra từ chính danh sách, và vì dùng CHUNG `queryKey` với trang danh sách nên mở trang
 * sửa không tốn thêm vòng mạng nào: cache đã ấm từ lúc còn ở danh sách.
 *
 * Đi qua đây thay vì mỗi trang tự `useQuery`: trùng key mà lệch `queryFn` là lớp lỗi
 * đã cắn một lần ở `['contest', id]` — hai nơi ghi hai hình dạng vào cùng một ô cache,
 * bên đọc sau nhận hình dạng của bên ghi trước.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AdminCourse, AdminTeam, Language } from './types'

export const COURSES_KEY = ['admin', 'courses'] as const
export const TEAMS_KEY = ['admin', 'teams'] as const
export const LANGUAGES_KEY = ['admin', 'languages'] as const

/**
 * `enabled` không phải để tối ưu: mọi endpoint `/api/admin/*` trả 403 cho mentor, nên
 * gọi vô điều kiện là rải lỗi console ở mọi màn dùng chung cho hai vai.
 */
export function useAdminCourses(enabled = true) {
  return useQuery({
    queryKey: COURSES_KEY,
    queryFn: () => api.get<AdminCourse[]>('/api/admin/courses'),
    enabled,
  })
}

export function useAdminTeams() {
  return useQuery({ queryKey: TEAMS_KEY, queryFn: () => api.get<AdminTeam[]>('/api/admin/teams') })
}

export function useAdminLanguages() {
  return useQuery({ queryKey: LANGUAGES_KEY, queryFn: () => api.get<Language[]>('/api/admin/languages') })
}

/**
 * `found` phân biệt ba trạng thái, và trang sửa cần cả ba: đang tải (`undefined`),
 * tải xong mà không có (`null` → hiện "không tìm thấy"), và có. Trả `null` cho cả hai
 * trường hợp đầu thì trang chớp "không tìm thấy" một nhịp trước khi dữ liệu về.
 */
function pick<T extends { id: string }>(
  query: { data?: T[]; isLoading: boolean; isError: boolean },
  id: string,
): { found: T | null | undefined; isLoading: boolean; isError: boolean } {
  return {
    found: query.data === undefined ? undefined : (query.data.find((r) => r.id === id) ?? null),
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export function useAdminCourse(id: string, enabled = true) {
  return pick(useAdminCourses(enabled), id)
}

export function useAdminTeam(id: string) {
  return pick(useAdminTeams(), id)
}

export function useAdminLanguage(id: string) {
  return pick(useAdminLanguages(), id)
}
