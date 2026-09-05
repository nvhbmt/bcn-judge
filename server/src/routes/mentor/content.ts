/** FR-C1/C2/C3: soạn chương, bài đọc, mục bài tập; sắp xếp; xuất bản. */
import { sql } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { isCourseStaff } from '@/auth/middleware'
import { db, q, tx } from '@/db/pool'
import { created, errors, ok } from '@/lib/apiResponse'
import { audit } from '@/lib/audit'
import { parseBody } from '@/lib/http'

export const mentorContentRoutes = new Hono()

async function guard(c: Context, courseId: string): Promise<boolean> {
  return isCourseStaff(c.get('user'), courseId)
}

/** Cây chương/mục của khoá — mentor thấy cả mục nháp. */
mentorContentRoutes.get('/:courseId/syllabus', async (c) => {
  const courseId = c.req.param('courseId')
  if (!(await guard(c, courseId))) return errors.notFound(c, 'Không tìm thấy khoá học.')

  const rows = await q<{
    section_id: string
    section_title: string
    section_position: number
    item_id: string | null
    item_title: string | null
    item_kind: string | null
    item_position: number | null
    item_status: string | null
    problem_id: string | null
    lesson_body_md: string | null
    visible_from: string | null
  }>(sql`
    SELECT s.id AS section_id, s.title AS section_title, s.position AS section_position,
           i.id AS item_id, i.title AS item_title, i.kind AS item_kind,
           i.position AS item_position, i.status AS item_status, i.problem_id,
           i.lesson_body_md, i.visible_from
    FROM sections s
    LEFT JOIN items i ON i.section_id = s.id
    WHERE s.course_id = ${courseId}
    ORDER BY s.position, i.position
  `)
  return ok(c, groupSyllabus(rows))
})

export function groupSyllabus(
  rows: {
    section_id: string
    section_title: string
    section_position: number
    item_id: string | null
    item_title: string | null
    item_kind: string | null
    item_position: number | null
    item_status: string | null
    problem_id: string | null
    lesson_body_md?: string | null
    visible_from?: string | null
  }[],
) {
  const sections = new Map<string, { id: string; title: string; position: number; items: unknown[] }>()
  for (const row of rows) {
    let section = sections.get(row.section_id)
    if (!section) {
      section = { id: row.section_id, title: row.section_title, position: row.section_position, items: [] }
      sections.set(row.section_id, section)
    }
    if (row.item_id) {
      section.items.push({
        id: row.item_id,
        title: row.item_title,
        kind: row.item_kind,
        position: row.item_position,
        status: row.item_status,
        problemId: row.problem_id,
        lessonBodyMd: row.lesson_body_md ?? null,
        visibleFrom: row.visible_from ?? null,
      })
    }
  }
  return [...sections.values()]
}

mentorContentRoutes.post('/:courseId/sections', async (c) => {
  const courseId = c.req.param('courseId')
  if (!(await guard(c, courseId))) return errors.notFound(c, 'Không tìm thấy khoá học.')
  const body = await parseBody(c, z.object({ title: z.string().min(1).max(200) }))
  if (!body.ok) return body.response

  const [row] = await q<{ id: string }>(sql`
    INSERT INTO sections (course_id, title, position)
    VALUES (${courseId}, ${body.data.title},
            COALESCE((SELECT max(position) + 1 FROM sections WHERE course_id = ${courseId}), 1))
    RETURNING id
  `)
  await audit(c.get('user').id, 'section.create', 'section', row!.id, null, { courseId })
  return created(c, row)
})

const itemSchema = z.object({
  sectionId: z.string().min(1),
  kind: z.enum(['lesson', 'problem']),
  title: z.string().min(1).max(200),
  lessonBodyMd: z.string().max(200_000).optional(),
  problemId: z.string().optional(),
})

mentorContentRoutes.post('/:courseId/items', async (c) => {
  const courseId = c.req.param('courseId')
  if (!(await guard(c, courseId))) return errors.notFound(c, 'Không tìm thấy khoá học.')
  const body = await parseBody(c, itemSchema)
  if (!body.ok) return body.response
  const d = body.data
  // CHECK ở DB đã chốt bất biến này, nhưng báo lỗi ở đây thì thông điệp dễ hiểu hơn.
  if ((d.kind === 'lesson') !== (d.problemId === undefined)) {
    return errors.badRequest(c, 'Bài đọc không kèm problemId; mục bài tập bắt buộc có problemId.')
  }

  const [row] = await q<{ id: string }>(sql`
    INSERT INTO items (section_id, kind, title, position, lesson_body_md, problem_id)
    SELECT ${d.sectionId}, ${d.kind}, ${d.title},
           COALESCE((SELECT max(position) + 1 FROM items WHERE section_id = ${d.sectionId}), 1),
           ${d.lessonBodyMd ?? null}, ${d.problemId ?? null}
    WHERE EXISTS (SELECT 1 FROM sections WHERE id = ${d.sectionId} AND course_id = ${courseId})
    RETURNING id
  `)
  if (!row) return errors.notFound(c, 'Chương không thuộc khoá này.')
  await audit(c.get('user').id, 'item.create', 'item', row.id, null, { kind: d.kind })
  return created(c, row)
})

const patchItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  lessonBodyMd: z.string().max(200_000).optional(),
  status: z.enum(['draft', 'published']).optional(),
  visibleFrom: z.string().datetime().nullable().optional(),
  sectionId: z.string().optional(),
  position: z.number().int().min(1).optional(),
})

/**
 * FR-C3 xuất bản + FR-C1 di chuyển. Cổng MỀM theo FR-D6 v0.5: bài chưa từng
 * validate hoặc validate lệch rev hiện hành → 409 kèm cảnh báo, gửi lại với
 * `confirm: true` là đi tiếp. Chỉ hai điều bị chặn CỨNG vì nằm ngoài FR-D6:
 * bài không có testcase nào, và bài còn testcase thiếu expected.
 */
mentorContentRoutes.patch('/:courseId/items/:itemId', async (c) => {
  const courseId = c.req.param('courseId')
  if (!(await guard(c, courseId))) return errors.notFound(c, 'Không tìm thấy khoá học.')
  const body = await parseBody(c, patchItemSchema.extend({ confirm: z.boolean().optional() }))
  if (!body.ok) return body.response
  const itemId = c.req.param('itemId')
  const d = body.data

  if (d.status === 'published') {
    const [check] = await q<{
      problem_id: string | null
      testcases: number
      missing_expected: number
      validated: boolean
    }>(sql`
      SELECT i.problem_id,
             (SELECT count(*)::int FROM testcases t WHERE t.problem_id = i.problem_id) AS testcases,
             (SELECT count(*)::int FROM testcases t WHERE t.problem_id = i.problem_id AND t.expected IS NULL) AS missing_expected,
             COALESCE(p.validated_testcase_rev = p.testcase_rev, false) AS validated
      FROM items i LEFT JOIN problems p ON p.id = i.problem_id
      WHERE i.id = ${itemId}
    `)
    if (!check) return errors.notFound(c, 'Không tìm thấy mục.')
    if (check.problem_id) {
      if (check.testcases === 0) {
        return errors.conflict(c, 'no_testcases', 'Bài chưa có testcase nào — không xuất bản được.')
      }
      if (check.missing_expected > 0) {
        return errors.conflict(
          c,
          'missing_expected',
          `${check.missing_expected} testcase còn thiếu đáp án — sinh đáp án bằng lời giải mẫu trước.`,
        )
      }
      if (!check.validated && !d.confirm) {
        return errors.conflict(
          c,
          'publish_validation_failed',
          'Bài chưa được kiểm bằng lời giải mẫu trên bộ testcase hiện tại. Xác nhận để xuất bản dù vậy.',
        )
      }
    }
  }

  const [row] = await q<{ id: string }>(sql`
    UPDATE items SET
      title = COALESCE(${d.title ?? null}, title),
      -- undefined = giữ nguyên; chuỗi rỗng = XOÁ. COALESCE đơn thuần thì không
      -- bao giờ xoá được nội dung đã viết (mismatch #4 do agent UI phát hiện).
      lesson_body_md = ${d.lessonBodyMd === undefined ? sql`lesson_body_md` : sql`NULLIF(${d.lessonBodyMd}, '')`},
      status = COALESCE(${d.status ?? null}, status),
      visible_from = ${d.visibleFrom === undefined ? sql`visible_from` : sql`${d.visibleFrom}::timestamptz`},
      section_id = COALESCE(${d.sectionId ?? null}, section_id),
      position = COALESCE(${d.position ?? null}, position),
      updated_at = now()
    WHERE id = ${itemId}
      AND EXISTS (SELECT 1 FROM sections s WHERE s.id = items.section_id AND s.course_id = ${courseId})
    RETURNING id
  `)
  if (!row) return errors.notFound(c, 'Không tìm thấy mục.')
  await audit(c.get('user').id, 'item.update', 'item', itemId, null, d)
  return ok(c, row)
})

/** Đổi thứ tự bằng một batch UPDATE trong transaction (FR-C1). */
mentorContentRoutes.put('/:courseId/order', async (c) => {
  const courseId = c.req.param('courseId')
  if (!(await guard(c, courseId))) return errors.notFound(c, 'Không tìm thấy khoá học.')
  const body = await parseBody(
    c,
    z.object({
      sections: z.array(z.object({ id: z.string(), position: z.number().int() })).optional(),
      items: z.array(z.object({ id: z.string(), sectionId: z.string(), position: z.number().int() })).optional(),
    }),
  )
  if (!body.ok) return body.response

  await tx(async (t) => {
    for (const s of body.data.sections ?? []) {
      await t.execute(sql`UPDATE sections SET position = ${s.position} WHERE id = ${s.id} AND course_id = ${courseId}`)
    }
    for (const i of body.data.items ?? []) {
      await t.execute(sql`
        UPDATE items SET position = ${i.position}, section_id = ${i.sectionId}
        WHERE id = ${i.id}
          AND EXISTS (SELECT 1 FROM sections s WHERE s.id = ${i.sectionId} AND s.course_id = ${courseId})
      `)
    }
  })
  return ok(c, { ok: true })
})

mentorContentRoutes.delete('/:courseId/items/:itemId', async (c) => {
  const courseId = c.req.param('courseId')
  if (!(await guard(c, courseId))) return errors.notFound(c, 'Không tìm thấy khoá học.')
  // Bài nộp trỏ item qua composite FK → chỉ xoá được mục chưa ai nộp.
  const [row] = await q<{ id: string }>(sql`
    DELETE FROM items WHERE id = ${c.req.param('itemId')}
      AND EXISTS (SELECT 1 FROM sections s WHERE s.id = items.section_id AND s.course_id = ${courseId})
      AND NOT EXISTS (SELECT 1 FROM submissions sub WHERE sub.item_id = items.id)
    RETURNING id
  `)
  if (!row) return errors.conflict(c, 'item_in_use', 'Mục đã có bài nộp — ẩn đi thay vì xoá.')
  await audit(c.get('user').id, 'item.delete', 'item', c.req.param('itemId'), null, null)
  return ok(c, { ok: true })
})

export { db }
