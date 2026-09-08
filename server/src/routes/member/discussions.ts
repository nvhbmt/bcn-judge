/**
 * Thảo luận cho từng bài (problem): hỏi/đáp, thread một cấp.
 *
 * CỔNG chống lộ lời giải (quyết định sản phẩm): chỉ ai ĐÃ AC bài — hoặc là staff
 * (mentor/admin) — mới đọc/đăng được. Người chưa giải được không thấy nội dung
 * (canAccess=false), nên thảo luận không thành nơi chép bài. Với contest còn một lớp
 * nữa (v0.8, dùng chung với lời giải chia sẻ — xem solved.ts): bài đang nằm trong một
 * contest ĐANG DIỄN RA thì đóng với mọi member, kể cả người đã AC qua khoá từ trước;
 * giao diện còn ẩn hẳn tab này trong lúc thi (workspace) cho chắc.
 *
 * Kiểm duyệt: tác giả sửa/xoá bài của mình; mentor/admin xoá được bất kỳ và GHIM
 * chủ đề. Xoá chủ đề kéo theo mọi trả lời (ON DELETE CASCADE).
 */
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { q } from '@/db/pool'
import { created, errors, ok } from '@/lib/apiResponse'
import { parseBody } from '@/lib/http'
import { contestEmbargoUntil, gateEmbargo, hasAced, isStaff, type Actor } from './solved'

export const memberDiscussionRoutes = new Hono()

/** null = vào được; còn lại là câu từ chối. */
async function denial(me: Actor, problemId: string): Promise<string | null> {
  if (isStaff(me)) return null
  if (!(await hasAced(me.id, problemId))) return GATE
  const until = await contestEmbargoUntil(problemId)
  return until ? gateEmbargo(until) : null
}

const titleSchema = z.string().trim().min(1).max(200)
const bodySchema = z.string().trim().min(1).max(5000)

const GATE = 'Giải được bài này rồi mới tham gia thảo luận được.'

// ─────────────────────────────────────────────────── Đọc + tạo, gắn theo bài

/** GET /api/member/discussion/problem/:problemId — danh sách chủ đề + trả lời. */
memberDiscussionRoutes.get('/problem/:problemId', async (c) => {
  const me = c.get('user') as Actor
  const problemId = c.req.param('problemId')
  const [prob] = await q(sql`SELECT id FROM problems WHERE id = ${problemId} AND deleted_at IS NULL`)
  if (!prob) return errors.notFound(c, 'Không tìm thấy bài.')

  const staff = isStaff(me)
  if (!staff) {
    // Chưa mở khoá: KHÔNG trả nội dung nào — chỉ nói cho FE dựng trạng thái "giải để mở",
    // hoặc "contest đang diễn ra, mở lại lúc …".
    if (!(await hasAced(me.id, problemId))) {
      return ok(c, { canAccess: false, reason: 'not_solved', embargoUntil: null, canPost: false, isStaff: false, threads: [] })
    }
    const until = await contestEmbargoUntil(problemId)
    if (until) {
      return ok(c, {
        canAccess: false,
        reason: 'contest_embargo',
        embargoUntil: until.toISOString(),
        canPost: false,
        isStaff: false,
        threads: [],
      })
    }
  }

  const threads = await q<{
    id: string
    title: string
    bodyMd: string
    authorId: string
    authorName: string
    createdAt: string
    editedAt: string | null
    pinned: boolean
  }>(sql`
    SELECT t.id, t.title, t.body_md AS "bodyMd", t.author_id AS "authorId",
           u.display_name AS "authorName", t.created_at AS "createdAt", t.edited_at AS "editedAt", t.pinned
    FROM discussion_threads t JOIN users u ON u.id = t.author_id
    WHERE t.problem_id = ${problemId}
    ORDER BY t.pinned DESC, t.created_at DESC
  `)
  const replies = await q<{
    id: string
    threadId: string
    bodyMd: string
    authorId: string
    authorName: string
    createdAt: string
    editedAt: string | null
  }>(sql`
    SELECT r.id, r.thread_id AS "threadId", r.body_md AS "bodyMd", r.author_id AS "authorId",
           u.display_name AS "authorName", r.created_at AS "createdAt", r.edited_at AS "editedAt"
    FROM discussion_replies r
    JOIN users u ON u.id = r.author_id
    JOIN discussion_threads t ON t.id = r.thread_id
    WHERE t.problem_id = ${problemId}
    ORDER BY r.created_at ASC
  `)

  const byThread = new Map<string, unknown[]>()
  for (const r of replies) {
    const arr = byThread.get(r.threadId) ?? []
    arr.push({
      id: r.id,
      bodyMd: r.bodyMd,
      authorId: r.authorId,
      authorName: r.authorName,
      createdAt: r.createdAt,
      editedAt: r.editedAt,
      isMine: r.authorId === me.id,
      canManage: r.authorId === me.id || staff,
    })
    byThread.set(r.threadId, arr)
  }

  return ok(c, {
    canAccess: true,
    reason: null,
    embargoUntil: null,
    canPost: true,
    isStaff: staff,
    threads: threads.map((t) => ({
      id: t.id,
      title: t.title,
      bodyMd: t.bodyMd,
      authorId: t.authorId,
      authorName: t.authorName,
      createdAt: t.createdAt,
      editedAt: t.editedAt,
      pinned: t.pinned,
      isMine: t.authorId === me.id,
      canManage: t.authorId === me.id || staff,
      canPin: staff,
      replies: byThread.get(t.id) ?? [],
    })),
  })
})

/** POST /api/member/discussion/problem/:problemId — mở chủ đề mới. */
memberDiscussionRoutes.post('/problem/:problemId', async (c) => {
  const me = c.get('user') as Actor
  const problemId = c.req.param('problemId')
  const [prob] = await q(sql`SELECT id FROM problems WHERE id = ${problemId} AND deleted_at IS NULL`)
  if (!prob) return errors.notFound(c, 'Không tìm thấy bài.')
  const tuChoi = await denial(me, problemId)
  if (tuChoi) return errors.forbidden(c, tuChoi)

  const body = await parseBody(c, z.object({ title: titleSchema, bodyMd: bodySchema }))
  if (!body.ok) return body.response
  const [row] = await q<{ id: string }>(sql`
    INSERT INTO discussion_threads (problem_id, author_id, title, body_md)
    VALUES (${problemId}, ${me.id}, ${body.data.title}, ${body.data.bodyMd})
    RETURNING id
  `)
  return created(c, row)
})

// ─────────────────────────────────────────────────── Thao tác trên chủ đề

/** POST /api/member/discussion/thread/:threadId/reply — trả lời một chủ đề. */
memberDiscussionRoutes.post('/thread/:threadId/reply', async (c) => {
  const me = c.get('user') as Actor
  const [t] = await q<{ problemId: string }>(
    sql`SELECT problem_id AS "problemId" FROM discussion_threads WHERE id = ${c.req.param('threadId')}`,
  )
  if (!t) return errors.notFound(c, 'Không tìm thấy chủ đề.')
  const tuChoi = await denial(me, t.problemId)
  if (tuChoi) return errors.forbidden(c, tuChoi)

  const body = await parseBody(c, z.object({ bodyMd: bodySchema }))
  if (!body.ok) return body.response
  const [row] = await q<{ id: string }>(sql`
    INSERT INTO discussion_replies (thread_id, author_id, body_md)
    VALUES (${c.req.param('threadId')}, ${me.id}, ${body.data.bodyMd})
    RETURNING id
  `)
  return created(c, row)
})

/** PATCH /api/member/discussion/thread/:threadId — sửa chủ đề (chỉ tác giả). */
memberDiscussionRoutes.patch('/thread/:threadId', async (c) => {
  const me = c.get('user') as Actor
  const [t] = await q<{ authorId: string }>(
    sql`SELECT author_id AS "authorId" FROM discussion_threads WHERE id = ${c.req.param('threadId')}`,
  )
  if (!t) return errors.notFound(c, 'Không tìm thấy chủ đề.')
  if (t.authorId !== me.id) return errors.forbidden(c, 'Chỉ sửa được bài của chính mình.')

  const body = await parseBody(c, z.object({ title: titleSchema.optional(), bodyMd: bodySchema.optional() }))
  if (!body.ok) return body.response
  await q(sql`
    UPDATE discussion_threads
    SET title = COALESCE(${body.data.title ?? null}, title),
        body_md = COALESCE(${body.data.bodyMd ?? null}, body_md),
        edited_at = now()
    WHERE id = ${c.req.param('threadId')}
  `)
  return ok(c, { ok: true })
})

/** DELETE /api/member/discussion/thread/:threadId — xoá (tác giả hoặc staff). */
memberDiscussionRoutes.delete('/thread/:threadId', async (c) => {
  const me = c.get('user') as Actor
  const [t] = await q<{ authorId: string }>(
    sql`SELECT author_id AS "authorId" FROM discussion_threads WHERE id = ${c.req.param('threadId')}`,
  )
  if (!t) return errors.notFound(c, 'Không tìm thấy chủ đề.')
  if (t.authorId !== me.id && !isStaff(me)) return errors.forbidden(c, 'Không xoá được chủ đề này.')
  await q(sql`DELETE FROM discussion_threads WHERE id = ${c.req.param('threadId')}`)
  return ok(c, { ok: true })
})

/** POST /api/member/discussion/thread/:threadId/pin — ghim/bỏ ghim (chỉ staff). */
memberDiscussionRoutes.post('/thread/:threadId/pin', async (c) => {
  const me = c.get('user') as Actor
  if (!isStaff(me)) return errors.forbidden(c, 'Chỉ mentor/admin ghim được chủ đề.')
  const body = await parseBody(c, z.object({ pinned: z.boolean() }))
  if (!body.ok) return body.response
  const [row] = await q<{ id: string }>(
    sql`UPDATE discussion_threads SET pinned = ${body.data.pinned} WHERE id = ${c.req.param('threadId')} RETURNING id`,
  )
  if (!row) return errors.notFound(c, 'Không tìm thấy chủ đề.')
  return ok(c, { ok: true })
})

// ─────────────────────────────────────────────────── Thao tác trên trả lời

/** PATCH /api/member/discussion/reply/:replyId — sửa trả lời (chỉ tác giả). */
memberDiscussionRoutes.patch('/reply/:replyId', async (c) => {
  const me = c.get('user') as Actor
  const [r] = await q<{ authorId: string }>(
    sql`SELECT author_id AS "authorId" FROM discussion_replies WHERE id = ${c.req.param('replyId')}`,
  )
  if (!r) return errors.notFound(c, 'Không tìm thấy trả lời.')
  if (r.authorId !== me.id) return errors.forbidden(c, 'Chỉ sửa được bài của chính mình.')

  const body = await parseBody(c, z.object({ bodyMd: bodySchema }))
  if (!body.ok) return body.response
  await q(sql`
    UPDATE discussion_replies SET body_md = ${body.data.bodyMd}, edited_at = now()
    WHERE id = ${c.req.param('replyId')}
  `)
  return ok(c, { ok: true })
})

/** DELETE /api/member/discussion/reply/:replyId — xoá (tác giả hoặc staff). */
memberDiscussionRoutes.delete('/reply/:replyId', async (c) => {
  const me = c.get('user') as Actor
  const [r] = await q<{ authorId: string }>(
    sql`SELECT author_id AS "authorId" FROM discussion_replies WHERE id = ${c.req.param('replyId')}`,
  )
  if (!r) return errors.notFound(c, 'Không tìm thấy trả lời.')
  if (r.authorId !== me.id && !isStaff(me)) return errors.forbidden(c, 'Không xoá được trả lời này.')
  await q(sql`DELETE FROM discussion_replies WHERE id = ${c.req.param('replyId')}`)
  return ok(c, { ok: true })
})
