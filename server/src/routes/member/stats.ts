/**
 * Thống kê của một bài dưới góc nhìn member — mục "Thống kê" trên thanh icon (FR-E3 v0.8,
 * mở cho mọi vai; trước đây spec chỉ định cho mentor và cũng chưa có endpoint).
 *
 * Chỉ SỐ GỘP, không tên người: phân bố verdict, ngôn ngữ, và thời gian chạy của bài AC
 * TỐT NHẤT mỗi người — đó là thứ so được ("mình đứng đâu"), còn mọi lần nộp gộp lại chỉ
 * đo người ta thử bao nhiêu lần.
 *
 * Phạm vi theo ngữ cảnh:
 *   - bài luyện (`itemId`): mọi bài nộp của `problem_id` đó ở MỌI ngữ cảnh — bài dùng
 *     chung thì thống kê chung, và nhiều dữ liệu hơn;
 *   - contest (`contestProblemId`): chỉ bài nộp của contest đó TRONG cửa sổ — khớp
 *     standings, và standings vốn đã cho biết ai AC nên không lộ gì mới.
 *
 * Không cache ở server: bốn câu đếm trên một bài là vài mili giây; client tự làm mới 15 s.
 */
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { q } from '@/db/pool'
import { errors, ok } from '@/lib/apiResponse'
import { getSettings } from '@/lib/settings'
import { resolveAccess } from './access'

export const memberStatsRoutes = new Hono()

const VERDICTS = ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE'] as const

/**
 * Mốc trên của 8 ô thời gian: 1/64 … 1/1 giới hạn của bài, và một ô "vượt giới hạn
 * gốc" (ngôn ngữ có hệ số nhân — Python ×3 — AC được dù quá con số gốc). Mốc theo
 * giới hạn chứ không theo dữ liệu, để biểu đồ đọc được ngay cả khi mọi bài đều 5 ms.
 */
export function timeBuckets(limitMs: number): number[] {
  const edges = [64, 32, 16, 8, 4, 2, 1].map((d) => Math.max(1, Math.ceil(limitMs / d)))
  return [...edges, Number.POSITIVE_INFINITY]
}

/** Phân vị kiểu "hạng gần nhất" (rank = ⌈p·n⌉) trên mảng ĐÃ SẮP XẾP; rỗng → null. */
export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const rank = Math.max(1, Math.min(sorted.length, Math.ceil(p * sorted.length)))
  return sorted[rank - 1]!
}

memberStatsRoutes.get('/problem', async (c) => {
  const me = c.get('user')
  const access = await resolveAccess(me, {
    itemId: c.req.query('itemId'),
    contestProblemId: c.req.query('contestProblemId'),
  })
  if (!access.ok) {
    return access.status === 403 ? errors.forbidden(c, access.message) : errors.notFound(c, access.message)
  }
  const a = access.access

  const scope = a.contestId
    ? sql`s.contest_id = ${a.contestId} AND s.received_at >= ${a.contestStartAt} AND s.received_at < ${a.contestEndAt}`
    : sql`TRUE`
  // IE là lỗi hệ thống, không phải kết quả của ai — không đếm vào bất kỳ con số nào.
  const base = sql`
    FROM submissions s
    WHERE s.problem_id = ${a.problemId} AND s.kind = 'submit' AND s.status = 'done'
      AND s.verdict <> 'IE' AND ${scope}`

  const [tot] = await q<{ submissions: number; users: number; solvedUsers: number }>(sql`
    SELECT count(*)::int AS submissions, count(DISTINCT s.user_id)::int AS users,
           count(DISTINCT s.user_id) FILTER (WHERE s.verdict = 'AC')::int AS "solvedUsers"
    ${base}`)
  const verdictRows = await q<{ verdict: string; n: number }>(sql`
    SELECT s.verdict, count(*)::int AS n ${base} GROUP BY s.verdict`)
  const langRows = await q<{ id: string; n: number }>(sql`
    SELECT s.language_id AS id, count(*)::int AS n ${base} GROUP BY s.language_id ORDER BY n DESC, id`)
  const best = await q<{ userId: string; timeMs: number | null; memoryKb: number | null }>(sql`
    SELECT DISTINCT ON (s.user_id) s.user_id AS "userId", s.time_ms_max AS "timeMs", s.memory_kb_max AS "memoryKb"
    ${base} AND s.verdict = 'AC'
    ORDER BY s.user_id, s.time_ms_max ASC NULLS LAST, s.received_at ASC`)
  const [prob] = await q<{ timeLimitMs: number | null }>(sql`
    SELECT time_limit_ms AS "timeLimitMs" FROM problems WHERE id = ${a.problemId}`)
  const limitMs = prob?.timeLimitMs ?? (await getSettings()).default_time_limit_ms

  const verdicts = Object.fromEntries(VERDICTS.map((v) => [v, 0])) as Record<(typeof VERDICTS)[number], number>
  for (const r of verdictRows) if (r.verdict in verdicts) verdicts[r.verdict as (typeof VERDICTS)[number]] = r.n

  const times = best.map((b) => b.timeMs).filter((t): t is number => t !== null).sort((x, y) => x - y)
  const edges = timeBuckets(limitMs)
  const buckets = edges.map((upTo, i) => ({
    upToMs: Number.isFinite(upTo) ? upTo : null,
    count: times.filter((t) => t <= upTo && (i === 0 || t > edges[i - 1]!)).length,
  }))

  const mineRow = best.find((b) => b.userId === me.id)
  const others = best.filter((b) => b.userId !== me.id && b.timeMs !== null)
  const mine = mineRow
    ? {
        bestTimeMs: mineRow.timeMs,
        bestMemoryKb: mineRow.memoryKb,
        // "Nhanh hơn X % người đã AC" — so với NGƯỜI KHÁC; một mình thì không có ai để
        // hơn, trả null thay vì 100 % rỗng nghĩa.
        fasterThanPct:
          mineRow.timeMs === null || others.length === 0
            ? null
            : Math.round((100 * others.filter((o) => (o.timeMs as number) > (mineRow.timeMs as number)).length) / others.length),
      }
    : null

  return ok(c, {
    submissions: tot?.submissions ?? 0,
    users: tot?.users ?? 0,
    solvedUsers: tot?.solvedUsers ?? 0,
    verdicts,
    languages: langRows.map((r) => ({ id: r.id, count: r.n })),
    time: { limitMs, p50: percentile(times, 0.5), p90: percentile(times, 0.9), buckets },
    mine,
  })
})
