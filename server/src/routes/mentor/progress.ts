/** FR-G3/G4: mentor duyệt bài nộp và xem ma trận tiến độ khoá (+ xuất CSV). */
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { isCourseStaff } from '../../auth/middleware'
import { q } from '../../db/pool'
import { errors, ok } from '../../lib/apiResponse'
import { toMentorSubmission, type RawSubmissionRow } from '../../serialize/submission'
import { bestSubmissions } from '../member/syllabus'

export const mentorProgressRoutes = new Hono()

/** GET /api/mentor/courses/:id/progress — ma trận member × bài tập. */
mentorProgressRoutes.get('/:courseId/progress', async (c) => {
  const courseId = c.req.param('courseId')
  if (!(await isCourseStaff(c.get('user'), courseId))) return errors.notFound(c, 'Không tìm thấy khoá học.')

  const items = await q<{ id: string; title: string; position: number }>(sql`
    SELECT i.id, i.title, i.position FROM items i
    JOIN sections s ON s.id = i.section_id
    WHERE s.course_id = ${courseId} AND i.kind = 'problem' AND i.status = 'published'
    ORDER BY s.position, i.position
  `)

  const cells = await q<{
    userId: string
    displayName: string
    itemId: string | null
    verdict: string | null
    points: string | null
    attempts: number
  }>(sql`
    WITH best AS (${bestSubmissions(courseId)})
    SELECT u.id AS "userId", u.display_name AS "displayName", best.item_id AS "itemId",
           best.verdict, best.points,
           COALESCE((SELECT count(*)::int FROM submissions sub
                     WHERE sub.item_id = best.item_id AND sub.user_id = u.id AND sub.kind = 'submit'), 0) AS attempts
    FROM course_enrollments ce
    JOIN users u ON u.id = ce.user_id
    LEFT JOIN best ON best.user_id = u.id
    WHERE ce.course_id = ${courseId} AND ce.status = 'active'
    ORDER BY u.display_name
  `)

  const byUser = new Map<string, { userId: string; displayName: string; cells: Record<string, unknown> }>()
  for (const row of cells) {
    let user = byUser.get(row.userId)
    if (!user) {
      user = { userId: row.userId, displayName: row.displayName, cells: {} }
      byUser.set(row.userId, user)
    }
    if (row.itemId) {
      user.cells[row.itemId] = {
        status: row.verdict === 'AC' ? 'da-ac' : row.verdict ? 'da-thu' : 'chua-lam',
        points: row.points === null ? null : Number(row.points),
        attempts: row.attempts,
      }
    }
  }

  const rows = [...byUser.values()]
  if (c.req.query('format') === 'csv') {
    const header = ['Họ tên', ...items.map((i) => i.title)].join(',')
    const body = rows
      .map((u) =>
        [
          `"${u.displayName.replaceAll('"', '""')}"`,
          ...items.map((i) => {
            const cell = u.cells[i.id] as { status?: string; points?: number } | undefined
            if (!cell || cell.status === 'chua-lam') return ''
            return cell.status === 'da-ac' ? 'AC' : String(cell.points ?? 0)
          }),
        ].join(','),
      )
      .join('\n')
    c.header('content-type', 'text/csv; charset=utf-8')
    c.header('content-disposition', 'attachment; filename="tien-do.csv"')
    return c.body(`﻿${header}\n${body}`)
  }

  return ok(c, { items, rows })
})

/** GET /api/mentor/courses/:id/submissions — duyệt bài nộp trong khoá (FR-G3). */
mentorProgressRoutes.get('/:courseId/submissions', async (c) => {
  const courseId = c.req.param('courseId')
  if (!(await isCourseStaff(c.get('user'), courseId))) return errors.notFound(c, 'Không tìm thấy khoá học.')

  const userId = c.req.query('userId')
  const itemId = c.req.query('itemId')
  const verdict = c.req.query('verdict')

  const rows = await q<
    RawSubmissionRow & {
      received_at: string
      finished_at: string | null
      display_name: string
      problem_title: string | null
    }
  >(sql`
    SELECT s.id, s.kind, s.user_id AS "userId", s.problem_id AS "problemId", s.item_id AS "itemId",
           s.contest_id AS "contestId", s.contest_problem_id AS "contestProblemId",
           s.language_id AS "languageId", s.source, s.source_bytes AS "sourceBytes", s.status, s.verdict,
           s.passed_weight AS "passedWeight", s.total_weight AS "totalWeight", s.time_ms_max AS "timeMsMax",
           s.memory_kb_max AS "memoryKbMax", s.compile_output AS "compileOutput", s.received_at,
           s.finished_at, s.queued_ms AS "queuedMs", s.judge_ms AS "judgeMs", s.attempt,
           u.display_name,
           -- LEFT JOIN vì bài xoá mềm vẫn còn bài nộp trỏ tới.
           p.title AS problem_title
    FROM submissions s
    JOIN items i ON i.id = s.item_id
    JOIN sections sec ON sec.id = i.section_id
    JOIN users u ON u.id = s.user_id
    LEFT JOIN problems p ON p.id = s.problem_id
    WHERE sec.course_id = ${courseId} AND s.kind = 'submit'
      ${userId ? sql`AND s.user_id = ${userId}` : sql``}
      ${itemId ? sql`AND s.item_id = ${itemId}` : sql``}
      ${verdict ? sql`AND s.verdict = ${verdict}` : sql``}
    ORDER BY s.seq DESC LIMIT 200
  `)

  return ok(
    c,
    rows.map((r) => ({
      ...toMentorSubmission({ ...r, receivedAt: r.received_at, finishedAt: r.finished_at }, undefined, {
        problemTitle: r.problem_title,
      }),
      displayName: r.display_name,
    })),
  )
})
