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

interface ItemGateRow {
  status: string
  visible_from: string | null
  course_id: string
  course_status: string
  is_staff: boolean
  is_enrolled: boolean
}

/**
 * Cổng chung cho MỌI mục giáo trình: đã xuất bản, tới lịch mở, khoá đang mở, user đã
 * ghi danh — staff của khoá và admin thì đi thẳng.
 *
 * Tách ra vì bài tập và bài đọc đi hai đường khác nhau nhưng phải chịu ĐÚNG một luật.
 * Chép luật thành hai bản là mở đường cho chúng trôi lệch, mà lệch ở đây nghĩa là một
 * mục hẹn giờ bị lộ trước giờ mở.
 */
function passesItemGate(user: AuthUser, row: ItemGateRow): boolean {
  if (user.role === 'admin' || row.is_staff) return true
  if (!row.is_enrolled || row.course_status !== 'open') return false
  if (row.status !== 'published') return false
  if (row.visible_from && new Date(row.visible_from) > new Date()) return false
  return true
}

/** Bài đọc của khoá (kind = 'lesson'): không có problem nên đi riêng, cổng thì dùng chung. */
export async function lessonForMember(
  user: AuthUser,
  itemId: string,
): Promise<{ id: string; title: string; bodyMd: string | null; courseId: string } | null> {
  const [row] = await q<ItemGateRow & { id: string; title: string; body_md: string | null }>(sql`
    SELECT i.id, i.title, i.lesson_body_md AS body_md, i.status, i.visible_from,
           c.id AS course_id, c.status AS course_status,
           EXISTS (SELECT 1 FROM course_mentors cm WHERE cm.course_id = c.id AND cm.user_id = ${user.id}) AS is_staff,
           EXISTS (SELECT 1 FROM course_enrollments ce
                   WHERE ce.course_id = c.id AND ce.user_id = ${user.id} AND ce.status = 'active') AS is_enrolled
    FROM items i
    JOIN sections s ON s.id = i.section_id
    JOIN courses c ON c.id = s.course_id
    WHERE i.id = ${itemId} AND i.kind = 'lesson'
  `)
  if (!row || !passesItemGate(user, row)) return null
  return { id: row.id, title: row.title, bodyMd: row.body_md, courseId: row.course_id }
}

/** Đường khoá học: item phải ĐÃ XUẤT BẢN, tới lịch mở, khoá đang mở, user đã ghi danh. */
async function accessByItem(user: AuthUser, itemId: string): Promise<AccessResult> {
  const [row] = await q<ItemGateRow & { problem_id: string }>(sql`
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
  if (!passesItemGate(user, row)) return NOT_FOUND

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
  // drizzle `execute()` trả timestamptz dạng CHUỖI — phải ép Date trước khi so sánh,
  // nếu không `now < row.start_at` so Date với string và luôn cho kết quả rác.
  const [row] = await q<{
    problem_id: string
    contest_id: string
    position: number
    sequential: boolean
    start_at: string
    end_at: string
    status: string
    course_id: string | null
    is_staff: boolean
    in_scope: boolean
  }>(sql`
    SELECT cp.problem_id, cp.contest_id, cp.position, ct.sequential, ct.start_at, ct.end_at, ct.status, ct.course_id,
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
  const startAt = new Date(row.start_at)
  const endAt = new Date(row.end_at)
  const isStaff = row.is_staff
  if (!isStaff) {
    if (row.status !== 'published' || !row.in_scope) return NOT_FOUND
    if (now < startAt) {
      return {
        ok: false,
        status: 403,
        code: 'contest_not_started',
        message: 'Contest chưa bắt đầu.',
      }
    }
    // FR-I8 (tuỳ chọn per contest, mặc định tắt): phải AC bài trước mới mở bài sau.
    if (row.sequential && row.position > 1) {
      const [prev] = await q<{ unlocked: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM submissions s
          JOIN contest_problems prev ON prev.id = s.contest_problem_id
          WHERE s.user_id = ${user.id} AND s.verdict = 'AC' AND s.kind = 'submit'
            AND prev.contest_id = ${row.contest_id} AND prev.position = ${row.position - 1}
        ) AS unlocked
      `)
      if (!prev?.unlocked) {
        return {
          ok: false,
          status: 403,
          code: 'sequential_locked',
          message: `Contest này mở tuần tự — phải AC bài ${row.position - 1} trước.`,
        }
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
      contestEndAt: endAt,
      contestStartAt: startAt,
      inContestWindow: now >= startAt && now < endAt,
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
