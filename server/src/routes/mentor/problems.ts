/** FR-D1…D7: soạn bài tập, testcase (tay + zip), kiểm tra bằng lời giải mẫu. */
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { createHash } from 'node:crypto'
import type { AuthUser } from '../../auth/session'
import { db, q, qt, tx } from '../../db/pool'
import { enqueue } from '../../judge/queue'
import { created, errors, ok } from '../../lib/apiResponse'
import { audit } from '../../lib/audit'
import { parseBody } from '../../lib/http'
import { getSettings } from '../../lib/settings'
import { ZipImportError, parseTestcaseZip } from '../../lib/zipImport'
import { toMentorProblem, type RawProblemRow, type RawTestcaseRow } from '../../serialize/problem'

export const mentorProblemRoutes = new Hono()

/**
 * Ai được sửa bài dùng chung (§2.3): `scope_course_id` NULL = ngân hàng toàn CLB
 * (admin + người tạo); khác NULL = thuộc khoá đó (mentor của khoá).
 */
async function canEdit(user: AuthUser, problemId: string): Promise<boolean> {
  if (user.role === 'admin') return true
  const [row] = await q<{ allowed: boolean }>(sql`
    SELECT (
      p.created_by = ${user.id}
      OR (p.scope_course_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM course_mentors cm
            WHERE cm.course_id = p.scope_course_id AND cm.user_id = ${user.id}))
    ) AS allowed
    FROM problems p WHERE p.id = ${problemId} AND p.deleted_at IS NULL
  `)
  return row?.allowed === true
}

const problemSchema = z.object({
  title: z.string().min(1).max(200),
  statementMd: z.string().min(1).max(200_000),
  inputDescMd: z.string().max(50_000).optional(),
  outputDescMd: z.string().max(50_000).optional(),
  constraintsMd: z.string().max(50_000).optional(),
  examples: z.array(z.object({ input: z.string(), output: z.string(), explanation: z.string().optional() })).optional(),
  timeLimitMs: z.number().int().min(100).max(60_000).optional(),
  memoryLimitMb: z.number().int().min(16).max(2048).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  allowedLanguageIds: z.array(z.string().max(40)).optional(),
  compareMode: z.enum(['trim', 'exact', 'float']).optional(),
  floatEps: z.number().optional(),
  starterCode: z.record(z.string(), z.string()).optional(),
  solutionLanguageId: z.string().max(40).optional(),
  solutionSource: z.string().max(200_000).optional(),
  solutionVisibility: z.enum(['mentor', 'after_ac', 'after_contest']).optional(),
  scopeCourseId: z.string().optional(),
})

mentorProblemRoutes.get('/', async (c) => {
  const me = c.get('user')
  const rows = await q<{ id: string; title: string; scope_course_id: string | null; testcases: number }>(sql`
    SELECT p.id, p.title, p.scope_course_id, p.difficulty, p.tags, p.testcase_rev,
           p.validated_testcase_rev, p.updated_at,
           (SELECT count(*)::int FROM testcases t WHERE t.problem_id = p.id) AS testcases
    FROM problems p
    WHERE p.deleted_at IS NULL AND (
      ${me.role === 'admin'} OR p.created_by = ${me.id}
      OR (p.scope_course_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM course_mentors cm WHERE cm.course_id = p.scope_course_id AND cm.user_id = ${me.id}))
    )
    ORDER BY p.updated_at DESC LIMIT 300
  `)
  return ok(c, rows)
})

mentorProblemRoutes.post('/', async (c) => {
  const body = await parseBody(c, problemSchema)
  if (!body.ok) return body.response
  const me = c.get('user')
  const [row] = await q<{ id: string }>(sql`
    INSERT INTO problems (title, statement_md, input_desc_md, output_desc_md, constraints_md,
                          time_limit_ms, memory_limit_mb, difficulty, compare_mode,
                          solution_language_id, solution_source, scope_course_id, created_by)
    VALUES (${body.data.title}, ${body.data.statementMd}, ${body.data.inputDescMd ?? null},
            ${body.data.outputDescMd ?? null}, ${body.data.constraintsMd ?? null},
            ${body.data.timeLimitMs ?? null}, ${body.data.memoryLimitMb ?? null},
            ${body.data.difficulty ?? null}, ${body.data.compareMode ?? 'trim'},
            ${body.data.solutionLanguageId ?? null}, ${body.data.solutionSource ?? null},
            ${body.data.scopeCourseId ?? null}, ${me.id})
    RETURNING id
  `)
  await audit(me.id, 'problem.create', 'problem', row!.id, null, { title: body.data.title })
  return created(c, { id: row!.id })
})

mentorProblemRoutes.get('/:id', async (c) => {
  const me = c.get('user')
  const problemId = c.req.param('id')
  if (!(await canEdit(me, problemId))) return errors.notFound(c, 'Không tìm thấy bài tập.')

  const [problem] = await q<RawProblemRow>(sql`
    SELECT id, title, statement_md AS "statementMd", input_desc_md AS "inputDescMd",
           output_desc_md AS "outputDescMd", constraints_md AS "constraintsMd", examples,
           time_limit_ms AS "timeLimitMs", memory_limit_mb AS "memoryLimitMb", difficulty, tags,
           allowed_language_ids AS "allowedLanguageIds", compare_mode AS "compareMode",
           starter_code AS "starterCode", solution_language_id AS "solutionLanguageId",
           solution_source AS "solutionSource", solution_visibility AS "solutionVisibility",
           testcase_rev AS "testcaseRev"
    FROM problems WHERE id = ${problemId} AND deleted_at IS NULL
  `)
  if (!problem) return errors.notFound(c, 'Không tìm thấy bài tập.')

  const testcases = await q<RawTestcaseRow>(sql`
    SELECT id, position, kind, weight, input, expected FROM testcases
    WHERE problem_id = ${problemId} ORDER BY position
  `)
  const s = await getSettings()
  const [validation] = await q<{ validated_testcase_rev: number | null; validated_at: Date | null }>(sql`
    SELECT validated_testcase_rev, validated_at FROM problems WHERE id = ${problemId}
  `)
  return ok(
    c,
    toMentorProblem(problem, testcases, {
      timeLimitMs: s.default_time_limit_ms,
      memoryLimitMb: s.default_memory_limit_mb,
    }),
    {
      validated: validation?.validated_testcase_rev === problem.testcaseRev,
      validatedAt: validation?.validated_at?.toISOString() ?? null,
    },
  )
})

mentorProblemRoutes.patch('/:id', async (c) => {
  const me = c.get('user')
  const problemId = c.req.param('id')
  if (!(await canEdit(me, problemId))) return errors.notFound(c, 'Không tìm thấy bài tập.')
  const body = await parseBody(c, problemSchema.partial())
  if (!body.ok) return body.response

  const d = body.data
  await db.execute(sql`
    UPDATE problems SET
      title = COALESCE(${d.title ?? null}, title),
      statement_md = COALESCE(${d.statementMd ?? null}, statement_md),
      input_desc_md = COALESCE(${d.inputDescMd ?? null}, input_desc_md),
      output_desc_md = COALESCE(${d.outputDescMd ?? null}, output_desc_md),
      constraints_md = COALESCE(${d.constraintsMd ?? null}, constraints_md),
      time_limit_ms = COALESCE(${d.timeLimitMs ?? null}, time_limit_ms),
      memory_limit_mb = COALESCE(${d.memoryLimitMb ?? null}, memory_limit_mb),
      difficulty = COALESCE(${d.difficulty ?? null}, difficulty),
      compare_mode = COALESCE(${d.compareMode ?? null}, compare_mode),
      solution_language_id = COALESCE(${d.solutionLanguageId ?? null}, solution_language_id),
      solution_source = COALESCE(${d.solutionSource ?? null}, solution_source),
      solution_visibility = COALESCE(${d.solutionVisibility ?? null}, solution_visibility),
      allowed_language_ids = COALESCE(${d.allowedLanguageIds ?? null}, allowed_language_ids),
      updated_at = now()
    WHERE id = ${problemId}
  `)
  await audit(me.id, 'problem.update', 'problem', problemId, null, Object.keys(d))
  return ok(c, { ok: true })
})

// ── Testcase (FR-D4) ──────────────────────────────────────────────────────────

const testcaseSchema = z.object({
  testcases: z
    .array(
      z.object({
        input: z.string(),
        expected: z.string().nullable().optional(),
        kind: z.enum(['sample', 'hidden']).default('hidden'),
        weight: z.number().int().min(1).max(1000).default(1),
      }),
    )
    .min(1)
    .max(500),
})

/** Thay TOÀN BỘ testcase và bump `testcase_rev` — bài nộp cũ giữ rev cũ để hiện
 *  banner "chấm trên bộ test cũ" và dẫn tới rejudge (FR-D9). */
mentorProblemRoutes.put('/:id/testcases', async (c) => {
  const me = c.get('user')
  const problemId = c.req.param('id')
  if (!(await canEdit(me, problemId))) return errors.notFound(c, 'Không tìm thấy bài tập.')
  const body = await parseBody(c, testcaseSchema)
  if (!body.ok) return body.response

  const s = await getSettings()
  let total = 0
  for (const [i, t] of body.data.testcases.entries()) {
    const size = Buffer.byteLength(t.input) + Buffer.byteLength(t.expected ?? '')
    if (size > s.max_testcase_file_bytes) {
      return errors.badRequest(c, `Testcase ${i + 1} vượt ${Math.round(s.max_testcase_file_bytes / 1024 / 1024)} MB.`)
    }
    total += size
  }
  if (total > s.max_testcases_total_bytes_per_problem) {
    return errors.badRequest(c, 'Tổng dung lượng testcase của bài vượt giới hạn.')
  }

  await tx(async (t) => {
    await t.execute(sql`DELETE FROM testcases WHERE problem_id = ${problemId}`)
    for (const [i, tc] of body.data.testcases.entries()) {
      const input = Buffer.from(tc.input, 'utf8')
      const expected = tc.expected === null || tc.expected === undefined ? null : Buffer.from(tc.expected, 'utf8')
      await t.execute(sql`
        INSERT INTO testcases (problem_id, position, kind, weight, input, expected,
                               input_bytes, expected_bytes, input_sha256)
        VALUES (${problemId}, ${i + 1}, ${tc.kind}, ${tc.weight}, ${input}, ${expected},
                ${input.length}, ${expected?.length ?? null},
                ${createHash('sha256').update(input).digest()})
      `)
    }
    await t.execute(sql`UPDATE problems SET testcase_rev = testcase_rev + 1, updated_at = now() WHERE id = ${problemId}`)
  })

  await audit(me.id, 'problem.testcases.replace', 'problem', problemId, null, { count: body.data.testcases.length })
  return ok(c, { count: body.data.testcases.length })
})

/**
 * FR-D4: tải testcase hàng loạt bằng zip theo quy ước `01.in` / `01.out`.
 * multipart chứ không base64 — file tới 64 MB, base64 phình thêm 33%.
 */
mentorProblemRoutes.post('/:id/testcases/zip', async (c) => {
  const me = c.get('user')
  const problemId = c.req.param('id')
  if (!(await canEdit(me, problemId))) return errors.notFound(c, 'Không tìm thấy bài tập.')

  const s = await getSettings()
  let zipBuffer: Buffer
  let generate = false
  let sampleCount = 0
  try {
    const form = await c.req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return errors.badRequest(c, 'Thiếu file zip (trường "file").')
    zipBuffer = Buffer.from(await file.arrayBuffer())
    generate = form.get('generate') === 'true'
    sampleCount = Number(form.get('sampleCount') ?? 0)
  } catch {
    return errors.badRequest(c, 'Không đọc được form tải lên.')
  }

  let parsed
  try {
    parsed = await parseTestcaseZip(zipBuffer, {
      maxZipBytes: s.max_zip_bytes,
      maxFileBytes: s.max_testcase_file_bytes,
      maxTotalBytes: s.max_testcases_total_bytes_per_problem,
      generate,
    })
  } catch (err) {
    if (err instanceof ZipImportError) return errors.badRequest(c, err.message, { code: err.code })
    throw err
  }

  await tx(async (t) => {
    await t.execute(sql`DELETE FROM testcases WHERE problem_id = ${problemId}`)
    for (const tc of parsed.testcases) {
      // `sampleCount` testcase đầu là MẪU (member thấy được), còn lại ẩn — đúng
      // luồng US-2: tải zip rồi đánh dấu hai cái đầu là mẫu.
      const kind = tc.position <= sampleCount ? 'sample' : 'hidden'
      await t.execute(sql`
        INSERT INTO testcases (problem_id, position, kind, weight, input, expected,
                               input_bytes, expected_bytes, input_sha256)
        VALUES (${problemId}, ${tc.position}, ${kind}, 1, ${tc.input}, ${tc.expected},
                ${tc.input.length}, ${tc.expected?.length ?? null},
                ${createHash('sha256').update(tc.input).digest()})
      `)
    }
    await t.execute(sql`UPDATE problems SET testcase_rev = testcase_rev + 1, updated_at = now() WHERE id = ${problemId}`)
  })

  await audit(me.id, 'problem.testcases.zip', 'problem', problemId, null, { count: parsed.testcases.length })
  return ok(c, { count: parsed.testcases.length, sampleCount, warnings: parsed.warnings })
})

/**
 * FR-D6: kiểm tra testcase bằng LỜI GIẢI MẪU. Xếp một lượt run `validate` — worker
 * chấm lời giải trên toàn bộ testcase; xanh thì ghi `validated_testcase_rev`.
 */
mentorProblemRoutes.post('/:id/validate', async (c) => {
  const me = c.get('user')
  const problemId = c.req.param('id')
  if (!(await canEdit(me, problemId))) return errors.notFound(c, 'Không tìm thấy bài tập.')

  const [problem] = await q<{ solution_source: string | null; solution_language_id: string | null }>(sql`
    SELECT solution_source, solution_language_id FROM problems WHERE id = ${problemId}
  `)
  if (!problem?.solution_source || !problem.solution_language_id) {
    return errors.badRequest(c, 'Bài chưa có lời giải mẫu để kiểm tra.')
  }
  const [count] = await q<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM testcases WHERE problem_id = ${problemId}
  `)
  if ((count?.n ?? 0) === 0) return errors.badRequest(c, 'Bài chưa có testcase nào.')

  const result = await enqueue({
    kind: 'run',
    userId: me.id,
    problemId,
    languageId: problem.solution_language_id,
    source: problem.solution_source,
    runTarget: 'validate',
  })
  if (!result.ok) return errors.badRequest(c, result.message, { code: result.code })
  return created(c, { id: result.id })
})
