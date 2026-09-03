/** FR-D1…D7: soạn bài tập, testcase (tay + zip), kiểm tra bằng lời giải mẫu. */
import { sql } from 'drizzle-orm'
import { languageAllowed } from '../../judge/languageAllowed'
import { Hono } from 'hono'
import { z } from 'zod'
import { createHash } from 'node:crypto'
import type { AuthUser } from '../../auth/session'
import { db, q, tx } from '../../db/pool'
import { enqueue, enqueueRejudgeForProblem } from '../../judge/queue'
import { created, errors, ok } from '../../lib/apiResponse'
import { audit } from '../../lib/audit'
import { parseBody } from '../../lib/http'
import { getSettings } from '../../lib/settings'
import { iso } from '../../lib/time'
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
  /** 'function' = người học chỉ viết một hàm, ghép với `harness` rồi biên dịch. */
  kind: z.enum(['stdio', 'function']).optional(),
  /** {languageId: mã harness}. Bắt buộc khi kind = 'function'. */
  harness: z.record(z.string().max(40), z.string().max(200_000)).optional(),
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

/**
 * Bài dạng function phải có harness, và harness phải viết cho ngôn ngữ mà hệ
 * thống biết ghép. Chặn ở đây thay vì để tới lúc chấm: sai cấu hình mà lọt xuống
 * worker thì mọi bài nộp thành IE, và IE không nói cho mentor biết họ thiếu gì.
 */
async function checkFunctionShape(
  kind: string,
  harness: Record<string, string> | undefined,
): Promise<string | null> {
  if (kind !== 'function') return null
  const entries = Object.entries(harness ?? {}).filter(([, src]) => src.trim().length > 0)
  if (entries.length === 0) return 'Bài dạng function phải có harness cho ít nhất một ngôn ngữ.'

  // Nguồn sự thật là bảng `languages`, không phải hằng số trong code: admin bật
  // tắt và cấu hình ngôn ngữ ở trang quản trị (NFR-9).
  const rows = await q<{ id: string }>(sql`
    SELECT id FROM languages WHERE function_source_filename IS NOT NULL
  `)
  const supported = new Set(rows.map((r) => r.id))
  const unsupported = entries.map(([id]) => id).filter((id) => !supported.has(id))
  if (unsupported.length > 0) return `Ngôn ngữ chưa hỗ trợ dạng function: ${unsupported.join(', ')}.`
  return null
}

mentorProblemRoutes.get('/', async (c) => {
  const me = c.get('user')
  // camelCase như route /:id — hai route cùng tài nguyên mà khác quy ước đặt tên
  // là cái bẫy client phải nhớ, không phải lựa chọn thiết kế.
  const rows = await q(sql`
    SELECT p.id, p.title, p.scope_course_id AS "scopeCourseId", p.difficulty, p.tags,
           p.testcase_rev AS "testcaseRev", p.validated_testcase_rev AS "validatedTestcaseRev",
           p.updated_at AS "updatedAt",
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
  const guard = await checkFunctionShape(body.data.kind ?? 'stdio', body.data.harness)
  if (guard) return errors.badRequest(c, guard)

  const [row] = await q<{ id: string }>(sql`
    -- Sáu cột cuối từng bị zod cho qua rồi INSERT bỏ quên: mentor tạo bài kèm
    -- starter code / tags / ví dụ thì mất sạch, im lặng. Cùng họ với lỗi đã sửa
    -- ở PATCH — lần đó không ai soi lại POST.
    INSERT INTO problems (title, kind, harness, statement_md, input_desc_md, output_desc_md, constraints_md,
                          time_limit_ms, memory_limit_mb, difficulty, compare_mode,
                          solution_language_id, solution_source, scope_course_id, created_by,
                          examples, tags, allowed_language_ids, float_eps, starter_code, solution_visibility)
    VALUES (${body.data.title}, ${body.data.kind ?? 'stdio'},
            ${JSON.stringify(body.data.harness ?? {})}::jsonb,
            ${body.data.statementMd}, ${body.data.inputDescMd ?? null},
            ${body.data.outputDescMd ?? null}, ${body.data.constraintsMd ?? null},
            ${body.data.timeLimitMs ?? null}, ${body.data.memoryLimitMb ?? null},
            ${body.data.difficulty ?? null}, ${body.data.compareMode ?? 'trim'},
            ${body.data.solutionLanguageId ?? null}, ${body.data.solutionSource ?? null},
            ${body.data.scopeCourseId ?? null}, ${me.id},
            ${JSON.stringify(body.data.examples ?? [])}::jsonb,
            ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(body.data.tags ?? [])}::jsonb)),
            ${body.data.allowedLanguageIds
              ? sql`ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(body.data.allowedLanguageIds)}::jsonb))`
              : sql`NULL`},
            ${body.data.floatEps ?? null},
            ${JSON.stringify(body.data.starterCode ?? {})}::jsonb,
            ${body.data.solutionVisibility ?? 'mentor'})
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
    SELECT id, title, kind, harness, statement_md AS "statementMd", input_desc_md AS "inputDescMd",
           output_desc_md AS "outputDescMd", constraints_md AS "constraintsMd", examples,
           time_limit_ms AS "timeLimitMs", memory_limit_mb AS "memoryLimitMb", difficulty, tags,
           allowed_language_ids AS "allowedLanguageIds", compare_mode AS "compareMode", float_eps AS "floatEps",
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
  // validated_at về đây là CHUỖI chứ không phải Date (xem lib/time.ts).
  const [validation] = await q<{ validated_testcase_rev: number | null; validated_at: Date | string | null }>(sql`
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
      validatedAt: iso(validation?.validated_at),
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
  // Kiểm trên trạng thái SAU khi ghép: đổi kind mà không gửi harness, hoặc gửi
  // harness cho bài vốn đã là function — cả hai đều phải hợp lệ ở kết quả cuối.
  if (d.kind !== undefined || d.harness !== undefined) {
    const [cur] = await q<{ kind: string; harness: Record<string, string> | null }>(sql`
      SELECT kind, harness FROM problems WHERE id = ${problemId}
    `)
    const guard = await checkFunctionShape(d.kind ?? cur?.kind ?? 'stdio', d.harness ?? cur?.harness ?? {})
    if (guard) return errors.badRequest(c, guard)
  }

  await db.execute(sql`
    UPDATE problems SET
      title = COALESCE(${d.title ?? null}, title),
      kind = COALESCE(${d.kind ?? null}, kind),
      harness = COALESCE(${d.harness ? JSON.stringify(d.harness) : null}::jsonb, harness),
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
      allowed_language_ids = CASE
        WHEN ${d.allowedLanguageIds ? JSON.stringify(d.allowedLanguageIds) : null}::jsonb IS NULL
          THEN allowed_language_ids
        ELSE ARRAY(SELECT jsonb_array_elements_text(${d.allowedLanguageIds ? JSON.stringify(d.allowedLanguageIds) : null}::jsonb))
      END,
      -- Năm cột dưới đây từng bị zod cho qua rồi UPDATE bỏ quên: dữ liệu mất im
      -- lặng còn audit thì ghi như đã đổi (agent UI phát hiện). FR-D1 bắt buộc tags.
      -- KHÔNG nội suy thẳng mảng JS rồi ép ::text[]: drizzle bung mảng thành hai
      -- tham số nên câu lệnh hoá ra (\$1, \$2)::text[] và Postgres ném lỗi. Vì
      -- vậy cột này chưa bao giờ đặt được, dù FR-D1 bắt buộc có tags. Đi vòng qua
      -- jsonb, giống seed-demo.ts.
      tags = CASE
        WHEN ${d.tags ? JSON.stringify(d.tags) : null}::jsonb IS NULL THEN tags
        ELSE ARRAY(SELECT jsonb_array_elements_text(${d.tags ? JSON.stringify(d.tags) : null}::jsonb))
      END,
      examples = COALESCE(${d.examples ? JSON.stringify(d.examples) : null}::jsonb, examples),
      starter_code = COALESCE(${d.starterCode ? JSON.stringify(d.starterCode) : null}::jsonb, starter_code),
      float_eps = COALESCE(${d.floatEps ?? null}, float_eps),
      scope_course_id = COALESCE(${d.scopeCourseId ?? null}, scope_course_id),
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
    // Kẹp cứng: giá trị âm/NaN làm mọi test thành ẩn, còn giá trị lớn biến TOÀN BỘ
    // testcase thành mẫu — tức lộ sạch bộ test cho member (NFR-2). Không tin client.
    const rawSampleCount = Number(form.get('sampleCount') ?? 0)
    sampleCount = Number.isFinite(rawSampleCount) ? Math.max(0, Math.floor(rawSampleCount)) : 0
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
    const sampleLimit = Math.min(sampleCount, Math.max(0, parsed.testcases.length - 1))
    for (const tc of parsed.testcases) {
      // `sampleCount` testcase đầu là MẪU (member thấy được), còn lại ẩn — đúng
      // luồng US-2. Luôn chừa ít nhất một testcase ẩn.
      const kind = tc.position <= sampleLimit ? 'sample' : 'hidden'
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

  const sampleLimitApplied = Math.min(sampleCount, Math.max(0, parsed.testcases.length - 1))
  await audit(me.id, 'problem.testcases.zip', 'problem', problemId, null, { count: parsed.testcases.length })
  return ok(c, { count: parsed.testcases.length, sampleCount: sampleLimitApplied, warnings: parsed.warnings })
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

  // Cùng chốt chặn mà đường member đã có. Thiếu nó, bài dạng function mà lời giải
  // mẫu viết bằng ngôn ngữ chưa có harness sẽ được xếp hàng rồi chết ở worker với
  // `harness_missing` — mentor chỉ thấy "IE" và không biết thiếu gì (FR-D6).
  if (!(await languageAllowed(problemId, problem.solution_language_id))) {
    return errors.badRequest(
      c,
      'Ngôn ngữ của lời giải mẫu chưa dùng được cho bài này — bài dạng function cần harness viết cho đúng ngôn ngữ đó.',
    )
  }

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

/**
 * FR-D6 / US-2: kết quả một lượt validate, qua serializer MENTOR.
 *
 * Đường /api/member/submissions/:id đi qua toMemberResult nên tước diff của
 * testcase ẩn — đúng cho member, nhưng làm tiêu chí US-2 ("báo rõ testcase 7 kèm
 * diff") không đạt được. Route này là đường mentor cho đúng lượt validate của
 * chính bài mình quản.
 */
mentorProblemRoutes.get('/:id/validate/:submissionId', async (c) => {
  const me = c.get('user')
  const problemId = c.req.param('id')
  if (!(await canEdit(me, problemId))) return errors.notFound(c, 'Không tìm thấy bài tập.')

  const [row] = await q<{ id: string; status: string; verdict: string | null; attempt: number; compile_output: string | null }>(sql`
    SELECT id, status, verdict, attempt, compile_output FROM submissions
    WHERE id = ${c.req.param('submissionId')} AND problem_id = ${problemId} AND run_target = 'validate'
  `)
  if (!row) return errors.notFound(c, 'Không tìm thấy lượt kiểm.')

  const results = await q(sql`
    SELECT position, is_sample AS "isSample", verdict, time_ms AS "timeMs", memory_kb AS "memoryKb",
           exit_code AS "exitCode", term_signal AS "termSignal", detail, stdout, stderr,
           mentor_stdout AS "mentorStdout", first_diff_line AS "firstDiffLine"
    FROM submission_results WHERE submission_id = ${row.id} AND attempt = ${row.attempt}
    ORDER BY position
  `)
  return ok(c, { id: row.id, status: row.status, verdict: row.verdict, compileOutput: row.compile_output, results })
})

/**
 * Nội dung ĐẦY ĐỦ của một testcase — bản xem trước ở route /:id cắt 2 KB, mà
 * PUT lại thay bằng đúng thứ client gửi: sửa vòng qua bản cắt là mất dữ liệu.
 */
mentorProblemRoutes.get('/:id/testcases/:testcaseId', async (c) => {
  const me = c.get('user')
  const problemId = c.req.param('id')
  if (!(await canEdit(me, problemId))) return errors.notFound(c, 'Không tìm thấy bài tập.')
  const [row] = await q<{ id: string; position: number; kind: string; weight: number; input: Buffer; expected: Buffer | null }>(sql`
    SELECT id, position, kind, weight, input, expected FROM testcases
    WHERE id = ${c.req.param('testcaseId')} AND problem_id = ${problemId}
  `)
  if (!row) return errors.notFound(c, 'Không tìm thấy testcase.')
  return ok(c, {
    id: row.id,
    position: row.position,
    kind: row.kind,
    weight: row.weight,
    input: row.input.toString('utf8'),
    expected: row.expected?.toString('utf8') ?? null,
  })
})

/**
 * FR-D9: chấm lại toàn bộ bài nộp của một bài sau khi sửa testcase.
 * Kết quả cũ được giữ nguyên trong lịch sử (attempt nằm trong PK của
 * submission_results), và bảng xếp hạng tính lại theo (ADR-9).
 */
mentorProblemRoutes.post('/:id/rejudge', async (c) => {
  const me = c.get('user')
  const problemId = c.req.param('id')
  if (!(await canEdit(me, problemId))) return errors.notFound(c, 'Không tìm thấy bài tập.')
  const body = await parseBody(c, z.object({ confirm: z.boolean().optional(), reason: z.string().max(200).optional() }))
  if (!body.ok) return body.response

  const [count] = await q<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM submissions
    WHERE problem_id = ${problemId} AND kind = 'submit' AND status = 'done'
  `)
  const total = count?.n ?? 0
  if (total === 0) return ok(c, { queued: 0 })

  // Chấm lại đổi điểm của người khác — bắt xác nhận, đừng để lỡ tay.
  if (!body.data.confirm) {
    return errors.conflict(
      c,
      'rejudge_confirm_required',
      `Sẽ chấm lại ${total} bài nộp và điểm có thể thay đổi. Xác nhận để tiếp tục.`,
      { total },
    )
  }

  const queued = await enqueueRejudgeForProblem(problemId, me.id, body.data.reason ?? 'rejudge:testcase_rev')
  await audit(me.id, 'problem.rejudge', 'problem', problemId, null, { queued })
  return ok(c, { queued })
})
