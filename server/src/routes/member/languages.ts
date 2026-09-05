/**
 * Danh sách ngôn ngữ đang bật — FE dựng dropdown từ đây (FR-D2, US-8).
 *
 * File riêng dù chỉ một route: nó từng ở nhờ trong courses.ts, và cái giá của ở nhờ
 * là người tìm "ngôn ngữ nằm đâu" phải mở file khoá học ra mới biết. Dữ liệu toàn
 * cục thì đứng tên mình.
 */
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { q } from '@/db/pool'
import { ok } from '@/lib/apiResponse'

export const memberLanguageRoutes = new Hono()

memberLanguageRoutes.get('/', async (c) => {
  const rows = await q<{ id: string; name: string; versionLabel: string | null; cmMode: string | null }>(sql`
    SELECT id, name, version_label AS "versionLabel", cm_mode AS "cmMode"
    FROM languages WHERE enabled = true ORDER BY position
  `)
  return ok(c, rows)
})

