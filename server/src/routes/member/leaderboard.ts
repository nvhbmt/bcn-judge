/**
 * GET /api/member/leaderboard?scope=individual|team&window=week|month|all&source=practice|contest|total
 *
 * Bảng xếp hạng TOÀN CLB (mọi khoá, mọi mục đã xuất bản), cho trang BXH riêng
 * (src/pages/leaderboard). Dẫn xuất bằng SQL từ `bestSubmissions` — cùng công thức
 * điểm (tỉ lệ × điểm tối đa theo độ khó) và cùng thứ tự (tổng điểm trước, rồi số bài
 * AC, rồi mốc ghi điểm sớm hơn — §2.7 v0.8) như BXH khoá và standings contest, nên các
 * con số nói cùng một chuyện ở mọi nơi.
 *
 * Cửa sổ thời gian tính THEO LỊCH giờ Việt Nam: "tuần" từ thứ Hai, "tháng" từ ngày 1.
 * date_trunc mặc định lấy tuần bắt đầu thứ Hai (chuẩn ISO), khớp thói quen ở đây.
 *
 * Ba NGUỒN điểm (v0.8): `practice` = bài luyện (như trước), `contest` = tổng điểm của
 * người đó trong từng contest theo đúng công thức standings (`scoredContestSubmissions`,
 * tôn trọng mốc đóng băng như member đang thấy), `total` (mặc định) = cộng cả hai.
 * Bài luyện thuộc kỳ theo `received_at`; contest thuộc kỳ theo `end_at` — contest tuần
 * kết thúc Chủ nhật tính cho tuần đó, contest đang chạy tính cho kỳ hiện tại.
 */
import { sql, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { memberCutoffSql, scoredContestSubmissions } from '@/contest/standings'
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
  const source = sourceOf(c.req.query('source'))

  // Hai nguồn điểm gộp theo NGƯỜI trước (một dòng mỗi người mỗi nguồn), rồi mới ghép
  // vào team — ghép thẳng hai bảng bài-nộp vào team_members là nhân chéo số dòng.
  const perUser = sql`
    best AS (${bestSubmissions(null, since)}),
    practice AS (
      SELECT user_id, count(*) FILTER (WHERE verdict = 'AC')::int AS ac,
             COALESCE(sum(points), 0) AS points, max(received_at) FILTER (WHERE points > 0) AS last_gain
      FROM best GROUP BY user_id
    ),
    cbest AS (${scoredContestSubmissions({ contestId: null, cutoff: memberCutoffSql, since })}),
    contest AS (
      SELECT user_id, count(*) FILTER (WHERE verdict = 'AC')::int AS ac,
             COALESCE(sum(points), 0) AS points, max(received_at) FILTER (WHERE points > 0) AS last_gain
      FROM cbest GROUP BY user_id
    ),
    merged AS (
      SELECT COALESCE(p.user_id, ct.user_id) AS user_id,
             COALESCE(p.ac, 0) AS practice_ac, COALESCE(p.points, 0) AS practice_points,
             COALESCE(ct.ac, 0) AS contest_ac, COALESCE(ct.points, 0) AS contest_points,
             GREATEST(p.last_gain, ct.last_gain) AS last_gain,
             (p.user_id IS NOT NULL) AS has_practice, (ct.user_id IS NOT NULL) AS has_contest
      FROM practice p FULL OUTER JOIN contest ct ON ct.user_id = p.user_id
    )`
  // Chỉ người CÓ hoạt động ở nguồn đang xem — nguồn "Bài luyện" không được lôi người
  // chỉ thi contest vào với 0 điểm (và ngược lại).
  const active =
    source === 'practice' ? sql`m.has_practice` : source === 'contest' ? sql`m.has_contest` : sql`(m.has_practice OR m.has_contest)`

  if (scope === 'team') {
    const [myTeam] = await q<{ id: string }>(sql`
      SELECT t.id FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE tm.user_id = ${me.id}
    `)
    // LEFT JOIN nên team chưa có điểm trong kỳ vẫn hiện (0đ).
    const rows = await q<TeamAgg & { id: string; name: string; memberCount: number }>(sql`
      WITH ${perUser}
      SELECT t.id, t.name, count(DISTINCT tm.user_id)::int AS "memberCount",
             COALESCE(sum(m.practice_ac), 0)::int AS "practiceAc", COALESCE(sum(m.practice_points), 0) AS "practicePoints",
             COALESCE(sum(m.contest_ac), 0)::int AS "contestAc", COALESCE(sum(m.contest_points), 0) AS "contestPoints",
             max(m.last_gain) AS "lastGain"
      FROM teams t
      JOIN team_members tm ON tm.team_id = t.id
      LEFT JOIN merged m ON m.user_id = tm.user_id AND ${active}
      GROUP BY t.id, t.name
    `)
    return ok(
      c,
      rank(rows, source).map((r) => ({
        rank: r.rank,
        id: r.id,
        name: r.name,
        acCount: r.acCount,
        totalPoints: Math.round(r.totalPoints),
        practicePoints: Math.round(r.practicePoints),
        contestPoints: Math.round(r.contestPoints),
        memberCount: r.memberCount,
        isMine: r.id === myTeam?.id,
      })),
    )
  }

  const rows = await q<TeamAgg & { userId: string; displayName: string }>(sql`
    WITH ${perUser}
    SELECT u.id AS "userId", u.display_name AS "displayName",
           m.practice_ac AS "practiceAc", m.practice_points AS "practicePoints",
           m.contest_ac AS "contestAc", m.contest_points AS "contestPoints", m.last_gain AS "lastGain"
    FROM merged m
    JOIN users u ON u.id = m.user_id
    WHERE u.disabled = false AND ${active}
  `)
  return ok(
    c,
    rank(rows, source)
      .slice(0, 300)
      .map((r) => ({
        rank: r.rank,
        userId: r.userId,
        displayName: r.displayName,
        acCount: r.acCount,
        totalPoints: r.totalPoints,
        practicePoints: r.practicePoints,
        contestPoints: r.contestPoints,
        isMe: r.userId === me.id,
      })),
  )
})

type Source = 'practice' | 'contest' | 'total'

function sourceOf(raw: string | undefined): Source {
  return raw === 'practice' || raw === 'contest' ? raw : 'total'
}

interface TeamAgg {
  practiceAc: number
  practicePoints: string | number
  contestAc: number
  contestPoints: string | number
  lastGain: string | Date | null
}

/**
 * Chọn tổng theo nguồn rồi xếp: tổng điểm, số bài AC, mốc ghi điểm sớm hơn, tên
 * (§2.7 v0.8). Làm ở TypeScript vì ba nguồn chỉ khác nhau ở phép cộng cuối — viết ba
 * ORDER BY trong SQL là ba bản chép của cùng một luật.
 */
function rank<T extends TeamAgg & { name?: string; displayName?: string }>(rows: T[], source: Source) {
  const withTotals = rows.map((r) => {
    const practicePoints = Number(r.practicePoints)
    const contestPoints = Number(r.contestPoints)
    const totalPoints =
      source === 'practice' ? practicePoints : source === 'contest' ? contestPoints : practicePoints + contestPoints
    const acCount = source === 'practice' ? r.practiceAc : source === 'contest' ? r.contestAc : r.practiceAc + r.contestAc
    const lastGain = r.lastGain === null ? null : new Date(r.lastGain).toISOString()
    return { ...r, practicePoints, contestPoints, totalPoints, acCount, lastGain }
  })
  return withTotals
    .sort(
      (a, b) =>
        b.totalPoints - a.totalPoints ||
        b.acCount - a.acCount ||
        (a.lastGain ?? '9999').localeCompare(b.lastGain ?? '9999') ||
        (a.name ?? a.displayName ?? '').localeCompare(b.name ?? b.displayName ?? '', 'vi'),
    )
    .map((r, i) => ({ ...r, rank: i + 1 }))
}
