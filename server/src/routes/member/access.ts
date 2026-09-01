/**
 * Suy quyền từ handle công khai (design.md §5, vòng 1 blocker #1 và #2).
 *
 * Client KHÔNG BAO GIỜ gửi `problemId`: nó gửi `itemId` (ngữ cảnh khoá) hoặc
 * `contestProblemId` (ngữ cảnh contest), server suy ra bài sau khi authorize.
 * Nhờ vậy "chấm bài A nhưng tính điểm cho bài B" là bất khả thi ở tầng API, và
 * composite FK ở §2.6 là lưới thứ hai dưới nó.
 */
import { sql } from 'drizzle-orm'
import { q } from '../../db/pool'
import type { AuthUser } from '../../auth/session'

export interface ProblemAccess {
  problemId: string
  itemId: string | null
  contestId: string | null
  contestProblemId: string | null
  /** null khi ngoài contest; khác null thì standings/embargo áp theo mốc này. */
  contestEndAt: Date | null
  contestStartAt: Date | null
  inContestWindow: boolean
}

export type AccessResult =
  | { ok: true; access: ProblemAccess }
  | { ok: false; status: 404 | 403; code: string; message: string }

const NOT_FOUND = { ok: false as const, status: 404 as const, code: 'not_found', message: 'Không tìm thấy bài tập.' }

/** Đường khoá học: item phải ĐÃ XUẤT BẢN, tới lịch mở, khoá đang mở, user đã ghi danh. */
async function accessByItem(user: AuthUser, itemId: string): Promise<AccessResult> {
  const [row] = await q<{
    problem_id: string
    status: string
    visible_from: Date | null
    course_id: string
    is_staff: boolean
    is_enrolled: boolean
    course_status: string
  }>(sql`
    SELECT i.problem_id, i.status, i.visible_from, c.id AS course_id, c.status AS course_status,
           EXISTS (SELECT 1 FROM course_mentors cm WHERE cm.course_id = c.id AND cm.user_id = ${user.id}) AS is_staff,
           EXISTS (SELECT 1 FROM course_enrollments ce
                   WHERE ce.course_id = c.id AND ce.user_id = ${user.id} AND ce.status = 'active') AS is_enrolled
    FROM items i
    JOIN sections s ON s.id = i.section_id
    JOIN courses c ON c.id = s.course_id
    WHERE i.id = ${itemId} AND i.kind = 'problem'
  `)
  if (!row || !row.problem_id) return NOT_FOUND

  const isStaff = user.role === 'admin' || row.is_staff
  if (!isStaff) {
    if (!row.is_enrolled || row.course_status !== 'open') return NOT_FOUND
    if (row.status !== 'published') return NOT_FOUND
    if (row.visible_from && row.visible_from > new Date()) return NOT_FOUND
  }
  return {
    ok: true,
    access: {
      problemId: row.problem_id,
      itemId,
      contestId: null,
      contestProblemId: null,
      contestEndAt: null,
      contestStartAt: null,
      inContestWindow: false,
    },
  }
}

/** Đường contest: chưa tới giờ bắt đầu thì server KHÔNG BAO GIỜ trả đề (FR-I3). */
async function accessByContestProblem(user: AuthUser, contestProblemId: string): Promise<AccessResult> {
  const [row] = await q<{
    problem_id: string
    contest_id: string
    start_at: Date
    end_at: Date
    status: string
    course_id: string | null
    is_staff: boolean
    in_scope: boolean
  }>(sql`
    SELECT cp.problem_id, cp.contest_id, ct.start_at, ct.end_at, ct.status, ct.course_id,
           (${user.role === 'admin'} OR EXISTS (
              SELECT 1 FROM course_mentors cm WHERE cm.course_id = ct.course_id AND cm.user_id = ${user.id}
           )) AS is_staff,
           (ct.course_id IS NULL OR EXISTS (
              SELECT 1 FROM course_enrollments ce
              WHERE ce.course_id = ct.course_id AND ce.user_id = ${user.id} AND ce.status = 'active'
           )) AS in_scope
    FROM contest_problems cp
    JOIN contests ct ON ct.id = cp.contest_id
    WHERE cp.id = ${contestProblemId} AND ct.deleted_at IS NULL
  `)
  if (!row) return NOT_FOUND

  const now = new Date()
  const isStaff = row.is_staff
  if (!isStaff) {
    if (row.status !== 'published' || !row.in_scope) return NOT_FOUND
    if (now < row.start_at) {
      return {
        ok: false,
        status: 403,
        code: 'contest_not_started',
        message: 'Contest chưa bắt đầu.',
      }
    }
  }
  return {
    ok: true,
    access: {
      problemId: row.problem_id,
      itemId: null,
      contestId: row.contest_id,
      contestProblemId,
      contestEndAt: row.end_at,
      contestStartAt: row.start_at,
      inContestWindow: now >= row.start_at && now < row.end_at,
    },
  }
}

export async function resolveAccess(
  user: AuthUser,
  handle: { itemId?: string | null; contestProblemId?: string | null },
): Promise<AccessResult> {
  if (handle.contestProblemId) return accessByContestProblem(user, handle.contestProblemId)
  if (handle.itemId) return accessByItem(user, handle.itemId)
  return { ok: false, status: 404, code: 'no_handle', message: 'Thiếu itemId hoặc contestProblemId.' }
}
