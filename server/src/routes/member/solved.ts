/**
 * Hai câu hỏi mà mọi tính năng "mở sau khi giải" đều phải hỏi — thảo luận
 * (discussions.ts) và lời giải chia sẻ (solutions.ts) dùng CHUNG một bản:
 *
 *   1. `hasAced` — người này đã nộp (không phải chạy thử) và được AC bài này chưa?
 *   2. `contestEmbargoUntil` — bài có đang nằm trong một contest ĐANG DIỄN RA không?
 *      Có thì mọi kênh trao đổi về bài đó đóng tới khi contest kết thúc, kể cả với
 *      người đã AC bài này qua khoá từ trước: đó chính là kẽ hở mà một bản riêng cho
 *      thảo luận từng để ngỏ — AC qua khoá rồi đọc thảo luận trong lúc contest dùng
 *      chung bài. Chép luật này thành hai bản là mở đường cho chúng trôi lệch lần nữa.
 *
 * Staff (mentor/admin) không chịu cấm vận: họ vốn đọc được mọi bài nộp qua đường mentor.
 */
import { sql } from 'drizzle-orm'
import { q } from '@/db/pool'

export interface Actor {
  id: string
  role: 'admin' | 'mentor' | 'member'
}

export const isStaff = (me: Actor): boolean => me.role === 'admin' || me.role === 'mentor'

/** Đã từng AC bài này (nộp, không phải chạy thử)? */
export async function hasAced(userId: string, problemId: string): Promise<boolean> {
  const [r] = await q(sql`
    SELECT 1 FROM submissions
    WHERE user_id = ${userId} AND problem_id = ${problemId} AND kind = 'submit' AND verdict = 'AC'
    LIMIT 1
  `)
  return Boolean(r)
}

/**
 * Mốc kết thúc MUỘN NHẤT trong các contest đã xuất bản đang mở có chứa bài; null = không
 * contest nào đang dùng bài → không cấm vận. Muộn nhất chứ không phải sớm nhất: hai
 * contest chồng nhau thì phải đợi cả hai xong.
 */
export async function contestEmbargoUntil(problemId: string, now = new Date()): Promise<Date | null> {
  const [r] = await q<{ until: Date | string | null }>(sql`
    SELECT max(ct.end_at) AS until
    FROM contest_problems cp
    JOIN contests ct ON ct.id = cp.contest_id
    WHERE cp.problem_id = ${problemId} AND ct.status = 'published' AND ct.deleted_at IS NULL
      AND ct.start_at <= ${now} AND ct.end_at > ${now}
  `)
  return r?.until ? new Date(r.until) : null
}

export const GATE_NOT_SOLVED = 'Giải được bài này rồi mới xem được.'
export const gateEmbargo = (until: Date): string =>
  `Bài này đang nằm trong một contest đang diễn ra — mở lại sau ${until.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`
