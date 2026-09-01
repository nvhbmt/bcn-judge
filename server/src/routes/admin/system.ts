/** FR-H1/H2/H3/H5: cấu hình ngôn ngữ, giới hạn mặc định, tình trạng chấm. */
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { q } from '../../db/pool'
import { queueStats, retryIeSubmissions } from '../../judge/queue'
import { errors, ok } from '../../lib/apiResponse'
import { audit } from '../../lib/audit'
import { parseBody } from '../../lib/http'
import { getSettings, setSetting } from '../../lib/settings'

export const adminSystemRoutes = new Hono()

// ── Ngôn ngữ (FR-H1, US-8: thêm ngôn ngữ KHÔNG cần deploy lại app) ───────────

adminSystemRoutes.get('/languages', async (c) => {
  const rows = await q(sql`
    SELECT id, name, version_label AS "versionLabel", image, source_filename AS "sourceFilename",
           compile_argv AS "compileArgv", run_argv AS "runArgv", time_factor AS "timeFactor",
           memory_extra_mb AS "memoryExtraMb", cm_mode AS "cmMode", enabled, position
    FROM languages ORDER BY position
  `)
  return ok(c, rows)
})

const languageSchema = z.object({
  id: z.string().min(1).max(40).regex(/^[a-z0-9]+$/, 'Id chỉ gồm chữ thường và số.'),
  name: z.string().min(1).max(60),
  // GET trả null cho các cột nullable và trả CHUỖI cho numeric (pg không tự ép).
  // Schema phải nhận lại đúng thứ mình vừa trả ra, nếu không round-trip là 400.
  versionLabel: z.string().max(60).nullable().optional(),
  image: z.string().min(1).max(200),
  sourceFilename: z.string().min(1).max(80),
  compileArgv: z.array(z.string()).nullable().optional(),
  runArgv: z.array(z.string()).min(1),
  timeFactor: z.union([z.number(), z.string()]).transform(Number).pipe(z.number().min(0.1).max(20)).optional(),
  memoryExtraMb: z.union([z.number(), z.string()]).transform(Number).pipe(z.number().int().min(0).max(2048)).optional(),
  cmMode: z.string().max(40).nullable().optional(),
  enabled: z.boolean().optional(),
  position: z.number().int().nullable().optional(),
})

adminSystemRoutes.put('/languages/:id', async (c) => {
  const body = await parseBody(c, languageSchema)
  if (!body.ok) return body.response
  const d = body.data
  if (d.id !== c.req.param('id')) return errors.badRequest(c, 'Id trong đường dẫn và body phải trùng nhau.')

  await q(sql`
    INSERT INTO languages (id, name, version_label, image, source_filename, compile_argv, run_argv,
                           time_factor, memory_extra_mb, cm_mode, enabled, position)
    VALUES (${d.id}, ${d.name}, ${d.versionLabel ?? null}, ${d.image}, ${d.sourceFilename},
            ${JSON.stringify(d.compileArgv ?? null)}::jsonb, ${JSON.stringify(d.runArgv)}::jsonb,
            ${d.timeFactor ?? 1}, ${d.memoryExtraMb ?? 0}, ${d.cmMode ?? null},
            ${d.enabled ?? false}, ${d.position ?? 99})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, version_label = EXCLUDED.version_label, image = EXCLUDED.image,
      source_filename = EXCLUDED.source_filename, compile_argv = EXCLUDED.compile_argv,
      run_argv = EXCLUDED.run_argv, time_factor = EXCLUDED.time_factor,
      memory_extra_mb = EXCLUDED.memory_extra_mb, cm_mode = EXCLUDED.cm_mode,
      enabled = EXCLUDED.enabled, position = EXCLUDED.position
  `)
  await audit(c.get('user').id, 'language.upsert', 'language', d.id, null, { enabled: d.enabled })
  return ok(c, { ok: true })
})

// ── Giới hạn mặc định (FR-H2) ────────────────────────────────────────────────

adminSystemRoutes.get('/settings', async (c) => ok(c, await getSettings()))

adminSystemRoutes.patch('/settings', async (c) => {
  const body = await parseBody(c, z.record(z.string(), z.unknown()))
  if (!body.ok) return body.response
  const known = await getSettings()
  const applied: string[] = []
  for (const [key, value] of Object.entries(body.data)) {
    if (!(key in known)) continue
    await setSetting(key, value, c.get('user').id)
    applied.push(key)
  }
  await audit(c.get('user').id, 'settings.update', 'settings', null, null, applied)
  return ok(c, { applied })
})

// ── Tình trạng chấm (FR-H3) ─────────────────────────────────────────────────

adminSystemRoutes.get('/judge', async (c) => {
  const stats = await queueStats()
  const workers = await q(sql`
    SELECT w.id, w.slots, w.version, w.started_at AS "startedAt", w.last_seen_at AS "lastSeenAt",
           (w.last_seen_at > now() - interval '30 seconds') AS alive,
           -- Số slot ĐANG chạy và số giây mất tín hiệu: "4 slot" một mình không nói
           -- worker đó đang bận hay rảnh, mà đó mới là thứ admin nhìn để biết hàng đợi
           -- ứ vì thiếu worker hay vì worker đang kẹt.
           (SELECT count(*)::int FROM submissions sub
            WHERE sub.worker_id = w.id AND sub.status = 'running') AS "running",
           GREATEST(0, EXTRACT(EPOCH FROM (now() - w.last_seen_at))::int) AS "silentSec"
    FROM workers w ORDER BY w.id
  `)
  const ie = await q(sql`
    SELECT s.id, s.user_id AS "userId", s.problem_id AS "problemId", s.ie_reason AS "ieReason",
           s.ie_retry AS "ieRetry", s.received_at AS "receivedAt"
    FROM submissions s
    WHERE s.verdict = 'IE' AND s.received_at > now() - interval '48 hours'
    ORDER BY s.seq DESC LIMIT 50
  `)
  const s = await getSettings()

  return ok(c, {
    queue: stats,
    workers,
    ieSubmissions: ie,
    judgePaused: s.judge_paused,
    // §9: hai băng tách bạch — backlog chạy thử KHÔNG được kéo chuông như backlog nộp bài.
    health: {
      submitBacklogAlarm: (stats.oldestPendingSubmitSec ?? 0) > 120,
      runBacklogWarning: stats.pendingRun > 50,
      noLiveWorker: workers.every((w) => (w as { alive: boolean }).alive === false),
    },
  })
})

adminSystemRoutes.post('/judge/retry-ie', async (c) => {
  const body = await parseBody(c, z.object({ withinHours: z.number().int().min(1).max(168).optional() }))
  if (!body.ok) return body.response
  const count = await retryIeSubmissions(body.data.withinHours ?? 24)
  await audit(c.get('user').id, 'judge.retry_ie', null, null, null, { count })
  return ok(c, { requeued: count })
})

adminSystemRoutes.post('/judge/pause', async (c) => {
  const body = await parseBody(c, z.object({ paused: z.boolean() }))
  if (!body.ok) return body.response
  await setSetting('judge_paused', body.data.paused, c.get('user').id)
  await audit(c.get('user').id, 'judge.pause', null, null, null, { paused: body.data.paused })
  return ok(c, { paused: body.data.paused })
})

/** FR-H4: nhật ký hành động quản trị. */
adminSystemRoutes.get('/audit', async (c) => {
  const rows = await q(sql`
    SELECT a.id, a.action, a.entity_type AS "entityType", a.entity_id AS "entityId",
           a.after, a.at, u.display_name AS "actorName"
    FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
    ORDER BY a.at DESC LIMIT 200
  `)
  return ok(c, rows)
})
