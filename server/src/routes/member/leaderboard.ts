/**
 * GET /api/member/leaderboard?scope=individual|team&window=week|month|all
 *
 * Bảng xếp hạng TOÀN CLB (mọi khoá, mọi mục đã xuất bản), cho trang BXH riêng
 * (src/pages/leaderboard). Dẫn xuất bằng SQL từ `bestSubmissions` — cùng công thức
 * điểm (tỉ lệ × điểm tối đa theo độ khó) và cùng thứ tự (tổng điểm trước, rồi số bài
 * AC, rồi mốc ghi điểm sớm hơn — §2.7 v0.8) như BXH khoá và standings contest, nên các
 * con số nói cùng một chuyện ở mọi nơi.
 *
 * Cửa sổ thời gian tính THEO LỊCH giờ Việt Nam: "tuần" từ thứ Hai, "tháng" từ ngày 1.
 * date_trunc mặc định lấy tuần bắt đầu thứ Hai (chuẩn ISO), khớp thói quen ở đây.
 */
import { sql, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { q } from '@/db/pool'
import { ok } from '@/lib/apiResponse'
import { bestSubmissions } from './syllabus'

export const memberLeaderboardRoutes = new Hono()

const TZ = 'Asia/Ho_Chi_Minh'

/** Mốc đầu cửa sổ (timestamptz) theo giờ VN; null = toàn thời gian. */
function sinceFor(win: string | undefined): SQL | null {
  if (win === 'week') return sql`date_trunc('week', now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}`
  if (win === 'month') return sql`date_trunc('month', now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}`
  return null
}

memberLeaderboardRoutes.get('/', async (c) => {
  const me = c.get('user')
  const scope = c.req.query('scope') === 'team' ? 'team' : 'individual'
  const since = sinceFor(c.req.query('window'))

  if (scope === 'team') {
    // Team của tôi để đánh dấu; LEFT JOIN nên team chưa có điểm trong kỳ vẫn hiện (0đ).
    const [myTeam] = await q<{ id: string }>(sql`
      SELECT t.id FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE tm.user_id = ${me.id}
    `)
    const rows = await q<{
      id: string
      name: string
      acCount: number
      totalPoints: string
      memberCount: number
      lastGain: string | null
    }>(sql`
      WITH best AS (${bestSubmissions(null, since)})
      SELECT t.id, t.name,
             count(best.user_id) FILTER (WHERE best.verdict = 'AC')::int AS "acCount",
             COALESCE(sum(best.points), 0) AS "totalPoints",
             count(DISTINCT tm.user_id)::int AS "memberCount",
             max(best.received_at) FILTER (WHERE best.points > 0) AS "lastGain"
      FROM teams t
      JOIN team_members tm ON tm.team_id = t.id
      LEFT JOIN best ON best.user_id = tm.user_id
      GROUP BY t.id, t.name
      ORDER BY "totalPoints" DESC, "acCount" DESC, "lastGain" ASC NULLS LAST, t.name ASC
    `)
    return ok(
      c,
      rows.map((r, i) => ({
        rank: i + 1,
        id: r.id,
        name: r.name,
        acCount: r.acCount,
        totalPoints: Math.round(Number(r.totalPoints)),
        memberCount: r.memberCount,
        isMine: r.id === myTeam?.id,
      })),
    )
  }

  // Cá nhân: chỉ người CÓ hoạt động trong kỳ (INNER JOIN best), xếp hạng đầy đủ.
  const rows = await q<{
    userId: string
    displayName: string
    acCount: number
    totalPoints: string
    lastGain: string | null
  }>(sql`
    WITH best AS (${bestSubmissions(null, since)})
    SELECT u.id AS "userId", u.display_name AS "displayName",
           count(*) FILTER (WHERE best.verdict = 'AC')::int AS "acCount",
           COALESCE(sum(best.points), 0) AS "totalPoints",
           max(best.received_at) FILTER (WHERE best.points > 0) AS "lastGain"
    FROM best
    JOIN users u ON u.id = best.user_id
    WHERE u.disabled = false
    GROUP BY u.id, u.display_name
    ORDER BY "totalPoints" DESC, "acCount" DESC, "lastGain" ASC NULLS LAST
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
