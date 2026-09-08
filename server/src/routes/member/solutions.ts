/**
 * Lời giải chia sẻ (FR-K v0.8) — mục "Lời giải" trên thanh icon: sau khi AC, xem bài AC
 * TỐT NHẤT của người khác (và lời giải mẫu của mentor nếu bài cho phép — FR-D7, trước
 * đây `mayMemberSeeSolution` không route nào gọi), rồi đặt cạnh bài của mình để so.
 *
 * Bốn luật, server là cổng, giao diện chỉ che (NFR-3):
 *   1. chỉ người ĐÃ AC bài (hoặc staff) — `hasAced`, dùng chung với thảo luận;
 *   2. CẤM VẬN khi bài đang nằm trong contest đang diễn ra — `contestEmbargoUntil`;
 *   3. chỉ bài AC tốt nhất của mỗi người (thời gian nhỏ nhất, rồi sớm nhất); không WA/TLE
 *      của ai cả — đó không phải "lời giải";
 *   4. tôn trọng `users.share_solutions` (opt-out); mình luôn thấy bài của mình.
 *
 * Danh sách KHÔNG mang source (100 bài × 3 KB là 300 KB cho một cú mở tab); source chỉ về
 * ở đường chi tiết. Serializer `toPeerSubmission` khai `never` cho mọi thứ không phải
 * mã nguồn và số đo: kết quả từng test, log biên dịch, stdout của người khác không bao giờ
 * đi qua đây.
 */
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { avatarUrl } from '@/auth/discordApi'
import type { AuthUser } from '@/auth/session'
import { q } from '@/db/pool'
import { errors, ok } from '@/lib/apiResponse'
import { toReferenceSolution } from '@/serialize/problem'
import { toPeerSubmission, type PeerRawRow } from '@/serialize/submission'
import { resolveAccess, type ProblemAccess } from './access'
import { GATE_NOT_SOLVED, contestEmbargoUntil, gateEmbargo, hasAced, isStaff } from './solved'

export const memberSolutionRoutes = new Hono()

type Sort = 'time' | 'memory' | 'recent'
const sortOf = (raw: string | undefined): Sort => (raw === 'memory' || raw === 'recent' ? raw : 'time')

interface Gate {
  me: AuthUser
  a: ProblemAccess
  staff: boolean
  hasAc: boolean
  embargoUntil: Date | null
}

/** Cổng chung của cả hai route: quyền xem đề → đã AC → không cấm vận. */
async function gate(c: Parameters<typeof errors.notFound>[0]): Promise<{ ok: true; g: Gate } | { ok: false; res: Response }> {
  const me = c.get('user') as AuthUser
  const access = await resolveAccess(me, {
    itemId: c.req.query('itemId'),
    contestProblemId: c.req.query('contestProblemId'),
  })
  if (!access.ok) {
    return { ok: false, res: access.status === 403 ? errors.forbidden(c, access.message) : errors.notFound(c, access.message) }
  }
  const staff = isStaff(me)
  const hasAc = staff || (await hasAced(me.id, access.access.problemId))
  const embargoUntil = staff ? null : await contestEmbargoUntil(access.access.problemId)
  return { ok: true, g: { me, a: access.access, staff, hasAc, embargoUntil } }
}

const closed = (reason: 'not_solved' | 'contest_embargo', until: Date | null) => ({
  canAccess: false,
  reason,
  embargoUntil: until?.toISOString() ?? null,
  mine: null,
  reference: null,
  peers: [],
})

const PEER_COLS = sql`
  s.id, s.user_id AS "userId", s.language_id AS "languageId", s.time_ms_max AS "timeMsMax",
  s.memory_kb_max AS "memoryKbMax", s.source_bytes AS "sourceBytes", s.received_at AS "receivedAt", s.source,
  u.display_name AS "authorName", u.discord_id AS "discordId", u.discord_avatar AS "discordAvatar",
  u.share_solutions AS "shareSolutions"`

type Row = PeerRawRow & { authorName: string; discordId: string | null; discordAvatar: string | null; shareSolutions: boolean }

/** GET /api/member/solutions?itemId|contestProblemId&languageId=&sort=time|memory|recent */
memberSolutionRoutes.get('/', async (c) => {
  const gated = await gate(c)
  if (!gated.ok) return gated.res
  const { me, a, staff, hasAc, embargoUntil } = gated.g
  if (!hasAc) return ok(c, closed('not_solved', null))
  if (embargoUntil) return ok(c, closed('contest_embargo', embargoUntil))

  const languageId = c.req.query('languageId') || null
  const sort = sortOf(c.req.query('sort'))

  const [mineRow] = await q<Row>(sql`
    SELECT DISTINCT ON (s.user_id) ${PEER_COLS}
    FROM submissions s JOIN users u ON u.id = s.user_id
    WHERE s.problem_id = ${a.problemId} AND s.user_id = ${me.id} AND s.kind = 'submit' AND s.verdict = 'AC'
    ORDER BY s.user_id, s.time_ms_max ASC NULLS LAST, s.received_at ASC`)

  const [problem] = await q<{ solutionLanguageId: string | null; solutionSource: string | null; solutionVisibility: string }>(sql`
    SELECT solution_language_id AS "solutionLanguageId", solution_source AS "solutionSource",
           solution_visibility AS "solutionVisibility"
    FROM problems WHERE id = ${a.problemId}`)
  const contestEnded = a.contestEndAt ? new Date() >= a.contestEndAt : null
  const reference = problem ? toReferenceSolution(problem, { hasAc, contestEnded, staff }) : null

  const rows = await q<Row>(sql`
    SELECT * FROM (
      SELECT DISTINCT ON (s.user_id) ${PEER_COLS}
      FROM submissions s JOIN users u ON u.id = s.user_id
      WHERE s.problem_id = ${a.problemId} AND s.user_id <> ${me.id}
        AND s.kind = 'submit' AND s.status = 'done' AND s.verdict = 'AC'
        AND u.share_solutions = true AND u.disabled = false AND u.deleted_at IS NULL
        ${languageId ? sql`AND s.language_id = ${languageId}` : sql``}
      ORDER BY s.user_id, s.time_ms_max ASC NULLS LAST, s.received_at ASC
    ) best
    ORDER BY ${
      sort === 'memory'
        ? sql`best."memoryKbMax" ASC NULLS LAST, best."timeMsMax" ASC NULLS LAST`
        : sort === 'recent'
          ? sql`best."receivedAt" DESC`
          : sql`best."timeMsMax" ASC NULLS LAST, best."memoryKbMax" ASC NULLS LAST`
    }, best."receivedAt" ASC
    LIMIT 100`)

  const view = (r: Row, includeSource: boolean) =>
    toPeerSubmission(r, {
      authorName: r.authorName,
      avatarUrl: avatarUrl(r.discordId, r.discordAvatar),
      isMine: r.userId === me.id,
      includeSource,
    })

  return ok(c, {
    canAccess: true,
    reason: null,
    embargoUntil: null,
    // Bài của mình mang source sẵn: màn so sánh cần nó ngay, không thêm một vòng mạng.
    mine: mineRow ? view(mineRow, true) : null,
    reference,
    peers: rows.map((r) => view(r, false)),
  })
})

/** GET /api/member/solutions/:id?itemId|contestProblemId — một bài AC kèm source. */
memberSolutionRoutes.get('/:id', async (c) => {
  const gated = await gate(c)
  if (!gated.ok) return gated.res
  const { me, a, hasAc, embargoUntil } = gated.g
  if (!hasAc) return errors.forbidden(c, GATE_NOT_SOLVED)
  if (embargoUntil) return errors.forbidden(c, gateEmbargo(embargoUntil))

  // Ràng vào ĐÚNG bài của handle: id của một bài nộp ở bài khác là 404, không phải
  // "xem được vì tôi AC bài kia".
  const [row] = await q<Row>(sql`
    SELECT ${PEER_COLS} FROM submissions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ${c.req.param('id')} AND s.problem_id = ${a.problemId}
      AND s.kind = 'submit' AND s.verdict = 'AC' AND u.deleted_at IS NULL`)
  // Người tắt chia sẻ: 404 như không tồn tại — không xác nhận "có nhưng bị ẩn".
  if (!row || (row.userId !== me.id && !row.shareSolutions)) return errors.notFound(c, 'Không tìm thấy lời giải.')

  return ok(
    c,
    toPeerSubmission(row, {
      authorName: row.authorName,
      avatarUrl: avatarUrl(row.discordId, row.discordAvatar),
      isMine: row.userId === me.id,
      includeSource: true,
    }),
  )
})
