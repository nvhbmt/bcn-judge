/**
 * Bảng xếp hạng contest (FR-I5, design.md §7) — TRUY VẤN DẪN XUẤT, không bảng điểm.
 *
 * Hệ quả cố ý: chấm lại (FR-D9) tự nhất quán, đóng băng (FR-I10) chỉ là một mốc
 * cắt truyền vào, và chế độ luyện tập (FR-I6) đúng theo cấu trúc — bài nộp ngoài
 * cửa sổ đơn giản là không lọt vào truy vấn.
 *
 * NFR-5: mốc thời gian là `received_at` (lúc NHẬN), không phải lúc chấm xong —
 * bài gửi 19:59:58 chấm xong 20:00:10 vẫn tính.
 */
import { sql } from 'drizzle-orm'
import { q } from '@/db/pool'

export interface StandingRow {
  rank: number
  userId: string
  displayName: string
  totalPoints: number
  acCount: number
  lastGain: string | null
  problems: Record<string, { points: number; verdict: string; attempts: number }>
  isMe: boolean
}

export interface StandingsOptions {
  /** Mốc cắt: member nhìn tới `end_at − freeze_minutes`, mentor nhìn tới vô cực. */
  cutoff: Date | 'infinity'
  meId: string
}

export async function computeStandings(contestId: string, opts: StandingsOptions): Promise<StandingRow[]> {
  const cutoff = opts.cutoff === 'infinity' ? sql`'infinity'::timestamptz` : sql`${opts.cutoff.toISOString()}::timestamptz`

  const rows = await q<{
    userId: string
    displayName: string
    contestProblemId: string
    points: string
    verdict: string
    attempts: number
    gainedAt: string | null
  }>(sql`
    WITH win AS (
      SELECT ct.id, ct.start_at, ct.end_at FROM contests ct WHERE ct.id = ${contestId}
    ),
    scored AS (
      SELECT DISTINCT ON (s.user_id, s.contest_problem_id)
             s.user_id, s.contest_problem_id, s.verdict, s.received_at,
             ROUND(s.passed_weight::numeric / NULLIF(s.total_weight, 0) * cp.max_score, 2) AS points
      FROM submissions s
      JOIN win ON true
      JOIN contest_problems cp ON cp.id = s.contest_problem_id
      WHERE s.contest_id = ${contestId}
        AND s.kind = 'submit' AND s.status = 'done'
        AND s.verdict NOT IN ('CE', 'IE')
        -- Chỉ bài nộp TRONG cửa sổ mới tính (FR-I4) và trước mốc đóng băng (FR-I10).
        AND s.received_at >= win.start_at AND s.received_at < win.end_at
        AND s.received_at < ${cutoff}
      ORDER BY s.user_id, s.contest_problem_id,
               (s.passed_weight::numeric / NULLIF(s.total_weight, 0)) DESC NULLS LAST,
               s.received_at ASC
    )
    SELECT u.id AS "userId", u.display_name AS "displayName",
           scored.contest_problem_id AS "contestProblemId",
           COALESCE(scored.points, 0) AS points, scored.verdict,
           (SELECT count(*)::int FROM submissions a
            WHERE a.contest_id = ${contestId} AND a.user_id = u.id
              AND a.contest_problem_id = scored.contest_problem_id AND a.kind = 'submit') AS attempts,
           scored.received_at AS "gainedAt"
    FROM scored JOIN users u ON u.id = scored.user_id
  `)

  const byUser = new Map<string, StandingRow>()
  for (const row of rows) {
    let user = byUser.get(row.userId)
    if (!user) {
      user = {
        rank: 0,
        userId: row.userId,
        displayName: row.displayName,
        totalPoints: 0,
        acCount: 0,
        lastGain: null,
        problems: {},
        isMe: row.userId === opts.meId,
      }
      byUser.set(row.userId, user)
    }
    const points = Number(row.points)
    user.problems[row.contestProblemId] = { points, verdict: row.verdict, attempts: row.attempts }
    user.totalPoints += points
    if (row.verdict === 'AC') user.acCount++
    // `lastGain` = thời điểm bài nộp CUỐI CÙNG làm tăng điểm (§2.7) — hoà thì
    // người đạt điểm sớm hơn xếp trên.
    if (points > 0 && row.gainedAt && (!user.lastGain || row.gainedAt > user.lastGain)) {
      user.lastGain = row.gainedAt
    }
  }

  return [...byUser.values()]
    .map((u) => ({ ...u, totalPoints: Math.round(u.totalPoints * 100) / 100 }))
    .sort(
      (a, b) =>
        b.totalPoints - a.totalPoints ||
        b.acCount - a.acCount ||
        (a.lastGain ?? '9999').localeCompare(b.lastGain ?? '9999') ||
        a.displayName.localeCompare(b.displayName, 'vi'),
    )
    .map((row, i) => ({ ...row, rank: i + 1 }))
}

/** Mốc cắt cho một người xem: mentor thấy hết, member bị đóng băng N phút cuối. */
export function cutoffFor(
  contest: { endAt: Date; freezeMinutes: number },
  isStaff: boolean,
  now = new Date(),
): Date | 'infinity' {
  if (isStaff || contest.freezeMinutes <= 0) return 'infinity'
  const freezeStart = new Date(contest.endAt.getTime() - contest.freezeMinutes * 60_000)
  // Sau khi contest kết thúc thì mở băng lại (FR-I10).
  if (now >= contest.endAt) return 'infinity'
  return freezeStart
}
