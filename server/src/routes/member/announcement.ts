/**
 * GET /api/member/announcement — banner thông báo toàn hệ thống (FR-H5).
 *
 * Dữ liệu toàn cục: ai đăng nhập cũng đọc được, không phụ thuộc khoá hay vai. Trả
 * `{ text: '' }` khi không có thông báo — chuỗi rỗng chứ không phải 404, để FE chỉ
 * cần kiểm tra một thứ.
 */
import { Hono } from 'hono'
import { ok } from '@/lib/apiResponse'
import { getSettings } from '@/lib/settings'

export const memberAnnouncementRoutes = new Hono()

memberAnnouncementRoutes.get('/', async (c) => {
  const s = await getSettings()
  return ok(c, { text: typeof s.announcement === 'string' ? s.announcement.trim() : '' })
})

