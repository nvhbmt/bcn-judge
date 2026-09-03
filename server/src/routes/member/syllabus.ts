/**
 * Giáo trình + tiến độ + bảng xếp hạng khoá dưới góc nhìn member.
 *
 * Tiến độ và BXH đều **dẫn xuất** bằng SQL (ADR-9/§2.7): không bảng điểm, không
 * job rebuild → chấm lại (FR-D9) tự nhất quán, không bao giờ lệch.
 */
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { q } from '../../db/pool'
import { errors, ok } from '../../lib/apiResponse'
import { iso } from '../../lib/time'
import { lessonForMember } from './access'
import { isEnrolledInOpenCourse } from './courses'

export const memberSyllabusRoutes = new Hono()

/** Bài nộp TỐT NHẤT của mỗi (user, item) trong phạm vi khoá — dùng chung 3 chỗ. */
/**
 * Bài nộp TỐT NHẤT của mỗi người ở mỗi mục, quy về thang 100.
 *
 * `courseId = null` = không giới hạn khoá, dùng cho bảng xếp hạng toàn CLB (team
 * không gắn khoá nào). Ba chỗ gọi cũ đều truyền một chuỗi nên hành vi không đổi.
 */
const bestSubmissions = (courseId: string | null) => sql`
  SELECT DISTINCT ON (s.user_id, s.item_id)
         s.user_id, s.item_id, s.problem_id, s.verdict,
         ROUND(s.passed_weight::numeric / NULLIF(s.total_weight, 0) * 100, 2) AS points,
         s.received_at
  FROM submissions s
  JOIN items i ON i.id = s.item_id
  JOIN sections sec ON sec.id = i.section_id
  WHERE ${courseId === null ? sql`TRUE` : sql`sec.course_id = ${courseId}`}
    AND i.status = 'published'
    AND s.kind = 'submit' AND s.status = 'done'
    AND s.verdict NOT IN ('CE', 'IE')
  ORDER BY s.user_id, s.item_id,
           (s.verdict = 'AC') DESC,
           (s.passed_weight::numeric / NULLIF(s.total_weight, 0)) DESC NULLS LAST,
           s.received_at ASC
`

/** GET /api/member/courses/:id/syllabus — cây chương/mục + trạng thái của TÔI. */
memberSyllabusRoutes.get('/:courseId/syllabus', async (c) => {
  const me = c.get('user')
  const courseId = c.req.param('courseId')
  if (!(await isEnrolledInOpenCourse(me.id, courseId))) return errors.notFound(c, 'Không tìm thấy khoá học.')

  const rows = await q<{
    sectionId: string
    sectionTitle: string
    sectionPosition: number
    unlockAt: Date | string | null
    itemId: string | null
    itemTitle: string | null
    itemKind: string | null
    itemPosition: number | null
    status: string | null
    attempts: number
    points: number | null
  }>(sql`
    SELECT s.id AS "sectionId", s.title AS "sectionTitle", s.position AS "sectionPosition",
           -- Mốc mở sớm nhất của chương: bài ĐÃ xuất bản nhưng chưa tới giờ hiện.
           -- Chương rỗng có hai lý do rất khác nhau — mentor đang soạn dở, hay nội dung
           -- đã sẵn và hẹn giờ mở — mà màn hình cũ nói cả hai bằng cùng một khoảng
           -- trống. Chỉ trả MỐC GIỜ, không trả tên bài: hẹn giờ là để chưa lộ đề.
           (SELECT min(i2.visible_from) FROM items i2
            WHERE i2.section_id = s.id AND i2.status = 'published'
              AND i2.visible_from IS NOT NULL AND i2.visible_from > now()) AS "unlockAt",
           i.id AS "itemId", i.title AS "itemTitle", i.kind AS "itemKind", i.position AS "itemPosition",
           CASE
             WHEN i.kind = 'lesson' THEN NULL
             WHEN best.verdict = 'AC' THEN 'da-ac'
             WHEN best.verdict IS NOT NULL THEN 'da-thu'
             ELSE 'chua-lam'
           END AS status,
           COALESCE((SELECT count(*)::int FROM submissions sub
                     WHERE sub.item_id = i.id AND sub.user_id = ${me.id} AND sub.kind = 'submit'), 0) AS attempts,
           best.points
    FROM sections s
    LEFT JOIN items i ON i.section_id = s.id
      AND i.status = 'published'
      AND (i.visible_from IS NULL OR i.visible_from <= now())
    LEFT JOIN (${bestSubmissions(courseId)}) best ON best.item_id = i.id AND best.user_id = ${me.id}
    WHERE s.course_id = ${courseId}
    ORDER BY s.position, i.position
  `)

  const sections = new Map<
    string,
    { id: string; title: string; position: number; unlockAt: string | null; items: unknown[] }
  >()
  for (const row of rows) {
    let section = sections.get(row.sectionId)
    if (!section) {
      section = {
        id: row.sectionId,
        title: row.sectionTitle,
        position: row.sectionPosition,
        unlockAt: iso(row.unlockAt),
        items: [],
      }
      sections.set(row.sectionId, section)
    }
    if (row.itemId) {
      section.items.push({
        id: row.itemId,
        title: row.itemTitle,
        kind: row.itemKind,
        position: row.itemPosition,
        status: row.status,
        attempts: row.attempts,
        points: row.points === null ? null : Number(row.points),
      })
    }
  }
  return ok(c, [...sections.values()])
})

/**
 * GET /api/member/courses/:id/leaderboard — FR-G6.
 * Xếp theo số bài AC, rồi tổng điểm chuẩn hoá, rồi `last_gain` sớm hơn xếp trên
 * (một định nghĩa duy nhất dùng chung với standings contest — §2.7).
 */
memberSyllabusRoutes.get('/:courseId/leaderboard', async (c) => {
  const me = c.get('user')
  const courseId = c.req.param('courseId')
  if (!(await isEnrolledInOpenCourse(me.id, courseId))) return errors.notFound(c, 'Không tìm thấy khoá học.')

  const rows = await q<{
    userId: string
    displayName: string
    acCount: number
    totalPoints: string
    lastGain: string | null
  }>(sql`
    WITH best AS (${bestSubmissions(courseId)})
    SELECT u.id AS "userId", u.display_name AS "displayName",
           count(*) FILTER (WHERE best.verdict = 'AC')::int AS "acCount",
           COALESCE(sum(best.points), 0) AS "totalPoints",
           max(best.received_at) FILTER (WHERE best.points > 0) AS "lastGain"
    FROM best
    JOIN users u ON u.id = best.user_id
    GROUP BY u.id, u.display_name
    ORDER BY "acCount" DESC, "totalPoints" DESC, "lastGain" ASC NULLS LAST
    LIMIT 300
  `)

  return ok(
    c,
    rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      displayName: r.displayName,
      acCount: r.acCount,
      totalPoints: Number(r.totalPoints),
      isMe: r.userId === me.id,
    })),
  )
})

export { bestSubmissions }

/**
 * GET /api/member/items/:itemId/lesson — nội dung một BÀI ĐỌC của giáo trình.
 *
 * Vì sao là route riêng chứ không nhét thân bài vào chính giáo trình: giáo trình là
 * danh sách, được gọi mỗi lần mở màn làm bài; kèm thân của mọi bài đọc vào đó thì một
 * khoá hai chục bài lý thuyết kéo theo hàng trăm KB cho mỗi lần liệt kê, trong khi
 * người đọc chỉ mở đúng một bài.
 *
 * Cổng kiểm dùng CHUNG với đường bài tập (`passesItemGate`), nên bài đọc hẹn giờ cũng
 * không lộ trước giờ mở.
 */
export const memberItemRoutes = new Hono()

memberItemRoutes.get('/:itemId/lesson', async (c) => {
  const lesson = await lessonForMember(c.get('user'), c.req.param('itemId'))
  if (!lesson) return errors.notFound(c, 'Không tìm thấy bài đọc.')
  return ok(c, lesson)
})
