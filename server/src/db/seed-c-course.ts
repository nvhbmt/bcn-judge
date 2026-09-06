/**
 * Seed khoá "C cơ bản" — 9 chương, 79 bài dạng stdio, ghi danh cho TẤT CẢ user.
 *
 *   npm run db:seed:c-course             # tạo nếu chưa có (idempotent theo mã khoá)
 *   npm run db:seed:c-course -- --reset  # xoá khoá cũ (kèm bài & bài nộp) rồi tạo lại
 *
 * "Cho tất cả mọi người": hệ không có cờ khoá công khai — member chỉ thấy khoá khi
 * ĐƯỢC GHI DANH và khoá `open` (member/courses.ts). Nên script ghi danh mọi user chưa
 * bị vô hiệu hoá, và bật `self_enroll` kèm mã khoá cho người vào sau.
 *
 * Dữ liệu bài + testcase nằm ở seed-c-course.data.json; `expected` của mỗi testcase
 * được sinh bằng cách CHẠY lời giải mẫu (xem quy trình soạn), rồi kiểm chứng lại bằng
 * cách biên dịch lại toàn bộ — nên script này KHÔNG cần trình biên dịch lúc chạy.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { pool, q, qt, tx } from './pool'

const RESET = process.argv.includes('--reset')
const COURSE_CODE = 'c-co-ban'
const COURSE_NAME = 'C cơ bản'
const COURSE_DESC =
  'Khoá nhập môn lập trình C: từ biến, kiểu dữ liệu, toán tử, rẽ nhánh, vòng lặp tới ' +
  'mảng, chuỗi, hàm và đệ quy. Mỗi bài tự động chấm, chỉ nộp bằng ngôn ngữ C.'

interface Tc {
  input: string
  expected: string
}
interface Prob {
  key: string
  title: string
  statementMd: string
  inputDescMd?: string
  outputDescMd?: string
  constraintsMd?: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  timeLimitMs: number
  referenceC: string
  testcases: Tc[]
}
interface Chapter {
  title: string
  problems: Prob[]
}

export async function seedCCourse(): Promise<void> {
  const dataPath = join(dirname(fileURLToPath(import.meta.url)), 'seed-c-course.data.json')
  const chapters = (JSON.parse(readFileSync(dataPath, 'utf8')).chapters as Chapter[]) ?? []
  const totalProblems = chapters.reduce((n, c) => n + c.problems.length, 0)
  if (!chapters.length || !totalProblems) throw new Error('seed-c-course.data.json rỗng')

  const [admin] = await q<{ id: string }>(sql`
    SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1
  `)
  if (!admin) throw new Error('Chưa có admin — chạy `npm run db:seed` trước.')

  const [existing] = await q<{ id: string }>(sql`SELECT id FROM courses WHERE code = ${COURSE_CODE}`)
  if (existing) {
    if (!RESET) {
      console.log(`Khoá "${COURSE_CODE}" đã tồn tại — bỏ qua (dùng -- --reset để tạo lại).`)
      return
    }
    console.log('--reset: xoá khoá cũ (bài nộp → bài → khoá)...')
    await q(sql`DELETE FROM submissions WHERE problem_id IN (SELECT id FROM problems WHERE scope_course_id = ${existing.id})`)
    await q(sql`DELETE FROM problems WHERE scope_course_id = ${existing.id}`)
    await q(sql`DELETE FROM courses WHERE id = ${existing.id}`)
  }

  await tx(async (t) => {
    const [course] = await qt<{ id: string }>(t, sql`
      INSERT INTO courses (code, name, description_md, status, self_enroll, created_by)
      VALUES (${COURSE_CODE}, ${COURSE_NAME}, ${COURSE_DESC}, 'open', true, ${admin.id})
      RETURNING id
    `)
    const courseId = course!.id

    // Ghi danh MỌI user chưa bị vô hiệu hoá (kể cả staff — họ cũng là "mọi người").
    const enrolled = await qt<{ user_id: string }>(t, sql`
      INSERT INTO course_enrollments (course_id, user_id, enrolled_by)
      SELECT ${courseId}, u.id, ${admin.id} FROM users u WHERE u.disabled = false
      ON CONFLICT DO NOTHING
      RETURNING user_id
    `)

    let probCount = 0
    let tcCount = 0
    for (const [ci, ch] of chapters.entries()) {
      const [sec] = await qt<{ id: string }>(t, sql`
        INSERT INTO sections (course_id, title, position)
        VALUES (${courseId}, ${ch.title}, ${ci + 1})
        RETURNING id
      `)
      for (const [pi, p] of ch.problems.entries()) {
        const examples = p.testcases.slice(0, 2).map((tc) => ({ input: tc.input, output: tc.expected }))
        const [prob] = await qt<{ id: string }>(t, sql`
          INSERT INTO problems (title, kind, statement_md, input_desc_md, output_desc_md, constraints_md,
                                examples, time_limit_ms, memory_limit_mb, difficulty, tags,
                                allowed_language_ids, compare_mode,
                                solution_language_id, solution_source, scope_course_id, created_by,
                                testcase_rev, validated_testcase_rev, validated_at)
          VALUES (${p.title}, 'stdio', ${p.statementMd}, ${p.inputDescMd ?? null}, ${p.outputDescMd ?? null},
                  ${p.constraintsMd ?? null}, ${JSON.stringify(examples)}::jsonb, ${p.timeLimitMs}, 256,
                  ${p.difficulty},
                  ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(p.tags)}::jsonb)),
                  ARRAY['c11']::text[], 'trim',
                  'c11', ${p.referenceC}, ${courseId}, ${admin.id}, 1, 1, now())
          RETURNING id
        `)
        const problemId = prob!.id
        for (const [i, tc] of p.testcases.entries()) {
          const inputBuf = Buffer.from(tc.input, 'utf8')
          const expectedBuf = Buffer.from(tc.expected, 'utf8')
          await qt(t, sql`
            INSERT INTO testcases (problem_id, position, kind, weight, input, expected,
                                   input_bytes, expected_bytes, input_sha256)
            VALUES (${problemId}, ${i + 1}, ${i < 2 ? 'sample' : 'hidden'}, 1, ${inputBuf}, ${expectedBuf},
                    ${inputBuf.length}, ${expectedBuf.length}, ${createHash('sha256').update(inputBuf).digest()})
          `)
          tcCount++
        }
        await qt(t, sql`
          INSERT INTO items (section_id, kind, title, position, status, problem_id)
          VALUES (${sec!.id}, 'problem', ${p.title}, ${pi + 1}, 'published', ${problemId})
        `)
        probCount++
      }
    }

    console.log(`✅ Khoá "${COURSE_NAME}" (${COURSE_CODE}):`)
    console.log(`   ${chapters.length} chương · ${probCount} bài · ${tcCount} testcase`)
    console.log(`   ghi danh ${enrolled.length} user · self_enroll bật (mã "${COURSE_CODE}")`)
  })
}

if (import.meta.filename === process.argv[1]) {
  await seedCCourse()
  await pool.end()
}
