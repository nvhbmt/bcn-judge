/**
 * Nạp một contest "Code C hằng tuần" từ file .docx của người ra đề.
 *
 *   npm run db:import:contest -- "<file>.docx" --data ../contests/tuan-01 --dry-run
 *   npm run db:import:contest -- "<file>.docx" --data ../contests/tuan-01 --validate
 *
 * Đề được soạn tay trong Word nên nó KHÔNG phải nguồn đáng tin: tuần 1 có ba chỗ
 * sai (một đáp án tính nhầm, một bài viết hoa không nhất quán với mô tả, một chỗ
 * quên `%.2f`). Vì vậy script tách làm hai phần rạch ròi:
 *
 *   - đọc .docx thì đọc NGUYÊN VĂN, không "đoán ý" người ra đề;
 *   - mọi sửa đổi nằm ở `fix.json` cạnh đề, có ghi lý do, và được IN RA lúc nạp.
 *
 * Sửa thẳng vào đề thì tháng sau không ai biết đã sửa gì và vì sao; sửa im lặng
 * trong parser thì tuần sau nó "sửa" nhầm một đề vốn đúng. File fix là đường duy
 * nhất, và nó đọc được như một bản ghi chú.
 *
 * `--validate` xếp lời giải mẫu vào hàng đợi rồi chờ worker chấm — đó là khác
 * biệt giữa "tôi tin bộ test đúng" và "máy chấm xác nhận bộ test đúng". Không có
 * cờ này thì bài nạp xong ở trạng thái CHƯA kiểm, đúng như thực tế.
 */
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { fromBuffer } from 'yauzl'
import { enqueue } from '@/judge/queue'
import { pool, q, qt, tx } from './pool'

// ── Đọc .docx ───────────────────────────────────────────────────────────────

/** Lấy một entry trong zip. yauzl là callback nên bọc lại cho gọn chỗ gọi. */
function readZipEntry(buf: Buffer, name: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    fromBuffer(buf, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error('Không đọc được .docx (zip hỏng).'))
      let found = false
      zip.on('entry', (entry) => {
        if (entry.fileName !== name) return zip.readEntry()
        found = true
        zip.openReadStream(entry, (e, stream) => {
          if (e || !stream) return reject(e ?? new Error(`Không mở được ${name}.`))
          const chunks: Buffer[] = []
          stream.on('data', (chunk: Buffer) => chunks.push(chunk))
          stream.on('end', () => resolve(Buffer.concat(chunks)))
          stream.on('error', reject)
        })
      })
      zip.on('end', () => {
        if (!found) reject(new Error(`.docx thiếu ${name} — file này có phải Word 2007+ không?`))
      })
      zip.on('error', reject)
      zip.readEntry()
    })
  })
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
}

/**
 * document.xml → một chuỗi mỗi đoạn văn.
 *
 * Word cắt một câu thành nhiều `<w:r>` mỗi khi định dạng đổi (một chữ in đậm là
 * đủ), nên phải nối MỌI `<w:t>` trong cùng `<w:p>` lại; đọc từng run một sẽ ra
 * chuỗi vụn và mọi regex bên dưới trượt hết.
 */
function docxParagraphs(xml: string): string[] {
  const paras = xml.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g) ?? []
  return paras.map((p) => {
    const withBreaks = p.replace(/<w:tab\/>/g, ' ').replace(/<w:br\/>/g, ' ')
    const texts = withBreaks.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) ?? []
    const raw = texts.map((t) => t.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>$/, '')).join('')
    return raw.replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m] ?? m).trim()
  })
}

// ── Phân tích đề ────────────────────────────────────────────────────────────

export interface ParsedTestcase {
  input: string
  expected: string
  /** Lý do đã sửa so với đề gốc; null nghĩa là lấy nguyên văn. */
  fixedWhy: string | null
}

export interface ParsedProblem {
  index: number
  title: string
  /** Nguyên văn dòng "Yêu cầu về hàm:". */
  functionNote: string
  statementMd: string
  inputDescMd: string
  outputDescMd: string
  testcases: ParsedTestcase[]
}

export interface ParsedContest {
  title: string
  /** Số tuần lấy từ dòng "(Tuần N)"; null nếu đề không ghi. */
  week: number | null
  /** Phần quy định ở đầu đề, mỗi đoạn một phần tử — thành mô tả contest. */
  rules: string[]
  problems: ParsedProblem[]
}

const RE_PROBLEM = /^Bài\s+(\d+)\s*[:.]\s*(.+)$/
const RE_WEEK = /^\(?\s*Tuần\s+(\d+)\s*\)?$/
const RE_FUNCTION_NOTE = /^Yêu cầu về hàm\s*:\s*(.*)$/
const RE_INPUT_DESC = /^Định dạng đầu vào\s*:\s*(.*)$/
const RE_OUTPUT_DESC = /^Định dạng đầu ra\s*:\s*(.*)$/
const RE_INPUT_HEAD = /^Đầu vào\s*$/
const RE_OUTPUT_HEAD = /^Đầu ra\s*$/
/** Câu chuyển trang của người ra đề, không thuộc phần quy định. */
const RE_PAGE_BREAK = /^Bài làm ở trang tiếp theo\s*$/

export function parseContest(paragraphs: string[]): ParsedContest {
  const lines = paragraphs.map((p) => p.trim())
  const firstProblem = lines.findIndex((l) => RE_PROBLEM.test(l))
  if (firstProblem < 0) throw new Error('Không tìm thấy dòng "Bài 1: …" nào — đề có đúng định dạng không?')

  const head = lines.slice(0, firstProblem).filter((l) => l.length > 0 && !RE_PAGE_BREAK.test(l))
  const title = head[0] ?? 'Contest'
  const week = head[1] !== undefined && RE_WEEK.test(head[1]) ? Number(RE_WEEK.exec(head[1])![1]) : null
  const rules = head.slice(week === null ? 1 : 2)

  // Cắt phần còn lại thành từng khối bài, rồi mới đọc trong khối — đọc tuần tự
  // một lượt sẽ phải mang theo trạng thái "đang ở bài nào, đang ở mục nào".
  const starts: number[] = []
  for (let i = firstProblem; i < lines.length; i++) if (RE_PROBLEM.test(lines[i]!)) starts.push(i)

  const problems = starts.map((start, n) => {
    const end = starts[n + 1] ?? lines.length
    return parseProblem(lines.slice(start, end))
  })
  return { title, week, rules, problems }
}

function parseProblem(block: string[]): ParsedProblem {
  const [, num, title] = RE_PROBLEM.exec(block[0]!)!
  const index = Number(num)
  const where = `Bài ${index}`

  let functionNote = ''
  let inputDescMd = ''
  let outputDescMd = ''
  const statement: string[] = []
  const inputs: string[] = []
  const outputs: string[] = []
  /** null = chưa tới bảng ví dụ. */
  let bucket: 'input' | 'output' | null = null

  for (const line of block.slice(1)) {
    if (RE_INPUT_HEAD.test(line)) { bucket = 'input'; continue }
    if (RE_OUTPUT_HEAD.test(line)) { bucket = 'output'; continue }
    if (bucket !== null) {
      // Dòng trống kết thúc bảng ví dụ; nếu không, đoạn trống cuối bài sẽ thành
      // một testcase rỗng và bài nào cũng lệch một dòng.
      if (line.length === 0) { bucket = null; continue }
      ;(bucket === 'input' ? inputs : outputs).push(line)
      continue
    }
    if (line.length === 0) continue

    const fn = RE_FUNCTION_NOTE.exec(line)
    if (fn) { functionNote = fn[1]!.trim(); continue }
    const inDesc = RE_INPUT_DESC.exec(line)
    if (inDesc) { inputDescMd = inDesc[1]!.trim(); continue }
    const outDesc = RE_OUTPUT_DESC.exec(line)
    if (outDesc) { outputDescMd = outDesc[1]!.trim(); continue }
    statement.push(line)
  }

  if (inputs.length === 0) throw new Error(`${where}: không có dòng "Đầu vào" nào.`)
  if (inputs.length !== outputs.length) {
    throw new Error(
      `${where}: ${inputs.length} dòng đầu vào nhưng ${outputs.length} dòng đầu ra — đề ghép cặp sai.`,
    )
  }
  if (statement.length === 0) throw new Error(`${where}: không có đoạn đề bài nào.`)

  return {
    index,
    title: title!.trim(),
    functionNote,
    statementMd: statement.join('\n\n'),
    inputDescMd,
    outputDescMd,
    testcases: inputs.map((input, i) => ({ input, expected: outputs[i]!, fixedWhy: null })),
  }
}

// ── Đính chính (fix.json) ───────────────────────────────────────────────────

interface FixFile {
  note?: string
  /**
   * Khoảng đoạn cần BỎ khỏi phần quy định: từ đoạn bắt đầu bằng `from`, tới trước
   * đoạn bắt đầu bằng `to` (bỏ trống `to` = tới hết).
   *
   * Có mục này vì phần đầu đề .docx mô tả quy trình nộp bài THỦ CÔNG (lưu .cpp, nén
   * .rar, gửi Zalo) — thứ mà chính hệ thống này thay thế. Để nguyên thì trang contest
   * dặn member làm một việc mâu thuẫn với cái họ đang nhìn.
   */
  dropRules?: { from: string; to?: string; why: string }[]
  problems?: Record<string, { testcases?: Record<string, { expected: string; why: string }> }>
}

/** Bỏ các khoảng đoạn mà fix.json chỉ định; trả về mô tả từng khoảng đã bỏ. */
export function applyRuleDrops(parsed: ParsedContest, fix: FixFile): string[] {
  const applied: string[] = []
  for (const drop of fix.dropRules ?? []) {
    const from = parsed.rules.findIndex((p) => p.startsWith(drop.from))
    if (from < 0) throw new Error(`fix.json: không thấy đoạn quy định nào bắt đầu bằng "${drop.from}".`)
    const to = drop.to === undefined
      ? parsed.rules.length
      : parsed.rules.findIndex((p, i) => i > from && p.startsWith(drop.to!))
    if (to < 0) throw new Error(`fix.json: không thấy đoạn kết bắt đầu bằng "${drop.to}" sau "${drop.from}".`)
    applied.push(`bỏ ${to - from} đoạn từ "${parsed.rules[from]!.slice(0, 45)}…" (${drop.why})`)
    parsed.rules.splice(from, to - from)
  }
  return applied
}

/**
 * Áp đính chính và trả về mô tả từng chỗ đã sửa.
 *
 * Cố tình khắt khe: đính chính trỏ vào bài/testcase không tồn tại, hoặc trỏ vào
 * một ô mà đề GỐC vốn đã đúng, đều là lỗi. Cả hai đều có nghĩa là file fix đã lạc
 * hậu so với đề — im lặng bỏ qua thì tuần sau nó sửa nhầm ô khác.
 */
export function applyFixes(parsed: ParsedContest, fix: FixFile): string[] {
  const applied: string[] = []
  for (const [key, spec] of Object.entries(fix.problems ?? {})) {
    const problem = parsed.problems.find((p) => p.index === Number(key))
    if (!problem) throw new Error(`fix.json: đề không có bài ${key}.`)
    for (const [tcKey, entry] of Object.entries(spec.testcases ?? {})) {
      const tc = problem.testcases[Number(tcKey) - 1]
      if (!tc) throw new Error(`fix.json: bài ${key} không có testcase ${tcKey}.`)
      if (tc.expected === entry.expected) {
        throw new Error(
          `fix.json: bài ${key} testcase ${tcKey} trong đề đã là "${entry.expected}" rồi — đính chính thừa, bỏ nó đi.`,
        )
      }
      applied.push(`Bài ${key} · test ${tcKey}: "${tc.expected}" → "${entry.expected}" (${entry.why})`)
      tc.expected = entry.expected
      tc.fixedWhy = entry.why
    }
  }
  return applied
}

// ── Kiểm tra trước khi ghi ──────────────────────────────────────────────────

/** Đề tuần này toàn bài stdio. Bài dạng function cần harness, script chưa nạp được. */
const RE_MAIN = /hàm\s+int\s+main\s*\(\s*\)/i

export function checkStdioOnly(parsed: ParsedContest): void {
  const odd = parsed.problems.filter((p) => !RE_MAIN.test(p.functionNote))
  if (odd.length === 0) return
  throw new Error(
    `Bài ${odd.map((p) => p.index).join(', ')} không yêu cầu viết trong int main() — đó là bài dạng ` +
      'function, cần harness cho từng ngôn ngữ (FR-D10). Script này mới nạp được bài stdio; ' +
      'soạn tay mấy bài đó ở trang mentor.',
  )
}

// ── Ghi vào DB ──────────────────────────────────────────────────────────────

export interface LoadOptions {
  /**
   * null = contest TOÀN CLB: `contests.course_id` và `problems.scope_course_id` đều
   * NULL, nên mọi member thấy ngay mà không cần ghi danh ai (xem member/contests.ts,
   * vế `ct.course_id IS NULL`). Đây là mặc định, vì "Code C hằng tuần" là sân chung
   * của cả quán chứ không phải một lớp có danh sách.
   *
   * Gắn khoá chỉ đáng làm khi thật sự cần cổng ghi danh — và nhớ rằng trang khoá chỉ
   * vẽ GIÁO TRÌNH, không liệt kê contest, nên khoá chỉ có contest sẽ hiện "0 bài".
   */
  courseCode: string | null
  courseName: string
  startAt: Date
  endAt: Date
  publish: boolean
  authorId: string
  solutions: Map<number, string>
  /** Ngôn ngữ duy nhất được nộp; đề bắt buộc C. */
  languageId: string
  reset: boolean
}

export interface LoadResult {
  /** null khi contest toàn CLB. */
  courseId: string | null
  contestId: string
  problems: { index: number; problemId: string; title: string; testcases: number }[]
}

async function findContest(courseId: string | null, title: string): Promise<string | null> {
  const [row] = await q<{ id: string }>(sql`
    SELECT id FROM contests
    WHERE title = ${title} AND deleted_at IS NULL
      AND course_id IS NOT DISTINCT FROM ${courseId}
  `)
  return row?.id ?? null
}

export async function loadContest(parsed: ParsedContest, opts: LoadOptions): Promise<LoadResult> {
  const contestTitle = parsed.week === null ? parsed.title : `${parsed.title} — Tuần ${parsed.week}`

  let courseId: string | null = null
  if (opts.courseCode !== null) {
    const [course] = await q<{ id: string }>(sql`
      INSERT INTO courses (code, name, description_md, status, created_by)
      VALUES (${opts.courseCode}, ${opts.courseName}, ${parsed.rules.join('\n\n')}, 'open', ${opts.authorId})
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
      RETURNING id
    `)
    courseId = course!.id
    await q(sql`
      INSERT INTO course_mentors (course_id, user_id, assigned_by)
      VALUES (${courseId}, ${opts.authorId}, ${opts.authorId})
      ON CONFLICT DO NOTHING
    `)
  }

  const existing = await findContest(courseId, contestTitle)
  if (existing !== null) {
    if (!opts.reset) {
      throw new Error(`Contest "${contestTitle}" đã có. Thêm --reset để nạp lại.`)
    }
    // Gom id bài TRƯỚC khi xoá contest: contest_problems cascade theo contest, nên
    // xoá xong thì không còn gì để lần ra mấy bài mồ côi nữa. (Bản trước lần theo
    // scope_course_id — sai ngay khi contest không gắn khoá, vì scope là NULL.)
    const orphans = await q<{ problem_id: string }>(sql`
      SELECT problem_id FROM contest_problems WHERE contest_id = ${existing}
    `)
    // FK submissions.contest_id không cascade, nên câu DELETE này tự hỏng khi đã
    // có người nộp bài — đúng ý muốn: nạp lại một contest đang chạy sẽ thổi bay
    // bảng xếp hạng, và cái chốt đó nên nằm ở DB chứ không ở trí nhớ người chạy.
    await q(sql`DELETE FROM contests WHERE id = ${existing}`)
    for (const o of orphans) {
      await q(sql`
        UPDATE problems SET deleted_at = now()
        WHERE id = ${o.problem_id} AND deleted_at IS NULL
          AND id NOT IN (SELECT problem_id FROM contest_problems)
      `)
    }
  }

  return await tx(async (t) => {
    const [contest] = await qt<{ id: string }>(t, sql`
      INSERT INTO contests (course_id, title, description_md, start_at, end_at, status,
                            scoring, penalty_minutes, sequential, freeze_minutes, created_by)
      VALUES (${courseId}, ${contestTitle}, ${parsed.rules.join('\n\n')},
              ${opts.startAt.toISOString()}, ${opts.endAt.toISOString()},
              ${opts.publish ? 'published' : 'draft'},
              'sum_score', 20, false, 0, ${opts.authorId})
      RETURNING id
    `)
    const contestId = contest!.id
    const problems: LoadResult['problems'] = []

    for (const p of parsed.problems) {
      // Đề công bố CẢ bảng ví dụ nên `examples` in lại đủ; còn hai test đầu để
      // kind='sample' theo đúng quy ước seed: "chạy thử" dùng test mẫu, "nộp"
      // mới chấm hết. Điểm thì tính trên MỌI test, mẫu lẫn ẩn (judge/runner.ts).
      const examples = p.testcases.map((tc) => ({ input: `${tc.input}\n`, output: `${tc.expected}\n` }))
      const solution = opts.solutions.get(p.index) ?? null
      const tags = ['Code C hằng tuần', parsed.week === null ? 'Chưa rõ tuần' : `Tuần ${parsed.week}`]

      const [row] = await qt<{ id: string }>(t, sql`
        INSERT INTO problems (title, kind, statement_md, input_desc_md, output_desc_md, constraints_md,
                              examples, time_limit_ms, memory_limit_mb, difficulty, tags,
                              allowed_language_ids, compare_mode,
                              solution_language_id, solution_source, solution_visibility,
                              scope_course_id, created_by, testcase_rev)
        VALUES (${`Bài ${p.index}: ${p.title}`}, 'stdio', ${p.statementMd},
                ${p.inputDescMd || null}, ${p.outputDescMd || null}, ${p.functionNote || null},
                ${JSON.stringify(examples)}::jsonb, 1000, 256, 'easy',
                ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(tags)}::jsonb)),
                ARRAY[${opts.languageId}]::text[],
                -- 'trim' chứ không phải 'float': đề cấm in dư/thiếu ký tự và tự ra
                -- lệnh dùng %.2f, nên sai số thập phân PHẢI bị tính là sai.
                'trim',
                ${solution === null ? null : opts.languageId}, ${solution}, 'mentor',
                ${courseId}, ${opts.authorId}, 1)
        RETURNING id
      `)
      const problemId = row!.id

      for (const [i, tc] of p.testcases.entries()) {
        const input = Buffer.from(`${tc.input}\n`, 'utf8')
        const expected = Buffer.from(`${tc.expected}\n`, 'utf8')
        await qt(t, sql`
          INSERT INTO testcases (problem_id, position, kind, weight, input, expected,
                                 input_bytes, expected_bytes, input_sha256)
          VALUES (${problemId}, ${i + 1}, ${i < 2 ? 'sample' : 'hidden'}, 1, ${input}, ${expected},
                  ${input.length}, ${expected.length}, ${createHash('sha256').update(input).digest()})
        `)
      }

      await qt(t, sql`
        INSERT INTO contest_problems (contest_id, problem_id, position, label, max_score)
        VALUES (${contestId}, ${problemId}, ${p.index}, ${String(p.index)}, 100)
      `)
      problems.push({ index: p.index, problemId, title: p.title, testcases: p.testcases.length })
    }

    return { courseId, contestId, problems }
  })
}

// ── Kiểm bằng lời giải mẫu (FR-D6) ──────────────────────────────────────────

interface ValidateOutcome {
  index: number
  title: string
  verdict: string
  detail: string | null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Xếp lời giải mẫu vào hàng đợi rồi chờ worker chấm thật. Đây là chỗ duy nhất
 * chứng minh bộ test đúng — kể cả sau khi fix.json đã sửa, một đáp án còn sai sẽ
 * hiện ra ở đây dưới dạng WA kèm số testcase.
 *
 * Script đi qua ĐÚNG hàm `enqueue` mà mentor bấm nút "kiểm" vẫn đi, nên nó ăn
 * cùng giới hạn `runs_per_minute` (mặc định 6). Nạp 10 bài thì chắc chắn chạm
 * trần, và cách xử đúng là CHỜ chứ không phải ghi thẳng vào bảng submissions:
 * lách giới hạn ở đây nghĩa là script chấm bằng một đường mà sản phẩm không có,
 * và bộ test sẽ được "xác nhận" bởi một luồng chẳng ai dùng thật.
 */
async function validateAll(
  result: LoadResult,
  authorId: string,
  languageId: string,
  report: (o: ValidateOutcome) => void,
): Promise<ValidateOutcome[]> {
  const deadline = Date.now() + 600_000
  const out: ValidateOutcome[] = []

  for (const p of result.problems) {
    const [row] = await q<{ solution_source: string | null }>(sql`
      SELECT solution_source FROM problems WHERE id = ${p.problemId}
    `)
    if (!row?.solution_source) {
      const skipped = { index: p.index, title: p.title, verdict: 'THIẾU LỜI GIẢI', detail: null }
      out.push(skipped)
      report(skipped)
      continue
    }

    const outcome = await validateOne(p, authorId, languageId, row.solution_source, deadline)
    out.push(outcome)
    report(outcome)
  }
  return out
}

async function validateOne(
  p: LoadResult['problems'][number],
  authorId: string,
  languageId: string,
  source: string,
  deadline: number,
): Promise<ValidateOutcome> {
  const fail = (verdict: string, detail: string | null): ValidateOutcome =>
    ({ index: p.index, title: p.title, verdict, detail })

  let submissionId = ''
  while (submissionId === '') {
    if (Date.now() >= deadline) return fail('HẾT GIỜ', 'không xếp được vào hàng đợi')
    const enqueued = await enqueue({
      kind: 'run',
      userId: authorId,
      problemId: p.problemId,
      languageId,
      source,
      runTarget: 'validate',
    })
    if (enqueued.ok) { submissionId = enqueued.id; break }
    // Cửa sổ đếm là 1 phút trượt, nên ngủ 5 giây rồi thử lại sẽ tự lọt khi lượt
    // cũ nhất rơi ra khỏi cửa sổ — không cần ngủ đủ 60 giây.
    if (enqueued.code !== 'run_rate_limited') return fail('KHÔNG XẾP ĐƯỢC', enqueued.message)
    await sleep(5_000)
  }

  while (Date.now() < deadline) {
    const [row] = await q<{ status: string; verdict: string | null }>(sql`
      SELECT status, verdict FROM submissions WHERE id = ${submissionId}
    `)
    if (row?.status !== 'done') { await sleep(400); continue }
    const verdict = row.verdict ?? '??'
    if (verdict === 'AC') return fail('AC', null)
    const [bad] = await q<{ position: number; verdict: string; first_diff_line: number | null }>(sql`
      SELECT position, verdict, first_diff_line FROM submission_results
      WHERE submission_id = ${submissionId} AND verdict <> 'AC'
      ORDER BY position LIMIT 1
    `)
    const where = bad === undefined
      ? null
      : `test ${bad.position} ${bad.verdict}${bad.first_diff_line === null ? '' : `, lệch từ dòng ${bad.first_diff_line}`}`
    return fail(verdict, where)
  }
  return fail('HẾT GIỜ', 'worker không trả kết quả — nó có đang chạy không?')
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function option(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : fallback
}

/** 23:59:59 thứ 7 sắp tới, theo múi giờ máy đang chạy — hạn nộp của đề. */
function nextSaturdayEnd(from = new Date()): Date {
  const d = new Date(from)
  d.setHours(23, 59, 59, 0)
  const ahead = (6 - d.getDay() + 7) % 7
  d.setDate(d.getDate() + ahead)
  return d
}

async function readSolutions(dir: string | null): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  if (dir === null) return out
  for (const name of await readdir(dir)) {
    const m = /^bai-(\d+)\.[cC]$/.exec(name)
    if (m) out.set(Number(m[1]), await readFile(join(dir, name), 'utf8'))
  }
  return out
}

async function main(): Promise<void> {
  const docxPath = process.argv[2]
  if (!docxPath || docxPath.startsWith('--')) {
    console.error('Dùng: npm run db:import:contest -- <file.docx> [--data <thư mục>] [--dry-run] [--validate]')
    process.exit(2)
  }

  const dataDir = option('data', '')
  const fixPath = dataDir === '' ? null : join(dataDir, 'fix.json')
  const solutionDir = dataDir === '' ? null : join(dataDir, 'solutions')

  const xml = (await readZipEntry(await readFile(docxPath), 'word/document.xml')).toString('utf8')
  const parsed = parseContest(docxParagraphs(xml))
  checkStdioOnly(parsed)

  const fix: FixFile = fixPath === null ? {} : JSON.parse(await readFile(fixPath, 'utf8'))
  const dropped = applyRuleDrops(parsed, fix)
  const fixes = applyFixes(parsed, fix)

  console.log(`\n${parsed.title}${parsed.week === null ? '' : ` — Tuần ${parsed.week}`}`)
  console.log(`  quy định: ${parsed.rules.length} đoạn`)
  for (const p of parsed.problems) {
    const fixed = p.testcases.filter((t) => t.fixedWhy !== null).length
    console.log(
      `  Bài ${String(p.index).padStart(2)}: ${p.title} — ${p.testcases.length} test` +
        `${fixed > 0 ? ` (${fixed} đã đính chính)` : ''}`,
    )
  }
  if (dropped.length > 0) {
    console.log(`\n  Đã bỏ khỏi phần quy định (${dropped.length}):`)
    for (const d of dropped) console.log(`    • ${d}`)
  }
  if (fixes.length > 0) {
    console.log(`\n  Đính chính so với đề gốc (${fixes.length}):`)
    for (const f of fixes) console.log(`    • ${f}`)
  }

  const solutions = await readSolutions(solutionDir)
  const missing = parsed.problems.filter((p) => !solutions.has(p.index)).map((p) => p.index)
  if (missing.length > 0) console.log(`\n  ⚠ thiếu lời giải mẫu cho bài: ${missing.join(', ')}`)

  if (flag('dry-run')) {
    console.log('\n--dry-run: không ghi gì vào DB.\n')
    return
  }

  const authorEmail = option('author', '')
  const [author] = await q<{ id: string; email: string }>(
    authorEmail === ''
      ? sql`SELECT id, email FROM users WHERE role = 'admin' AND deleted_at IS NULL ORDER BY created_at LIMIT 1`
      : sql`SELECT id, email FROM users WHERE email = ${authorEmail} AND deleted_at IS NULL`,
  )
  if (!author) throw new Error(authorEmail === '' ? 'DB chưa có admin nào — chạy db:seed trước.' : `Không có user ${authorEmail}.`)

  const startAt = option('start', '') === '' ? new Date() : new Date(option('start', ''))
  const endAt = option('end', '') === '' ? nextSaturdayEnd() : new Date(option('end', ''))
  if (!(endAt > startAt)) throw new Error('--end phải sau --start.')

  const result = await loadContest(parsed, {
    // Mặc định KHÔNG gắn khoá — xem LoadOptions.courseCode.
    courseCode: option('course', '') === '' ? null : option('course', ''),
    courseName: option('course-name', parsed.title),
    startAt,
    endAt,
    publish: !flag('draft'),
    authorId: author.id,
    solutions,
    languageId: option('language', 'c11'),
    reset: flag('reset'),
  })

  console.log(`\n  phạm vi ${result.courseId === null ? 'toàn CLB — mọi member thấy ngay, không cần ghi danh' : `khoá ${result.courseId}`}`)
  console.log(`  contest ${result.contestId} · ${flag('draft') ? 'nháp' : 'đã xuất bản'}`)
  console.log(`  mở      ${startAt.toLocaleString('vi-VN')} → ${endAt.toLocaleString('vi-VN')}`)
  console.log(`  bài     ${result.problems.length}, tổng ${result.problems.reduce((s, p) => s + p.testcases, 0)} testcase`)
  console.log(`  tác giả ${author.email}`)

  if (flag('validate')) {
    console.log('\n  Kiểm bằng lời giải mẫu (cần worker đang chạy; chạm trần 6 lượt/phút thì script tự chờ)…')
    const outcomes = await validateAll(result, author.id, option('language', 'c11'), (o) => {
      const ok = o.verdict === 'AC'
      console.log(`    ${ok ? '✓' : '✗'} Bài ${String(o.index).padStart(2)} ${o.verdict}${o.detail === null ? '' : ` — ${o.detail}`}`)
    })
    const bad = outcomes.filter((o) => o.verdict !== 'AC').length
    console.log(bad === 0 ? '\n  Toàn bộ bộ test đã được máy chấm xác nhận.' : `\n  ⚠ ${bad} bài chưa xanh — xem lại fix.json.`)
  } else {
    console.log('\n  Bài đang ở trạng thái CHƯA kiểm. Thêm --validate, hoặc bấm “kiểm” ở trang mentor.')
  }
  console.log()
}

if (import.meta.filename === process.argv[1]) {
  try {
    await main()
  } catch (err) {
    console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}\n`)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}
