/**
 * NFR-2 / US-6 — test canary chống rò dữ liệu ẩn.
 *
 * Cách làm: cắm chuỗi mồi vào testcase ẩn (input, expected), vào lời giải tham
 * khảo và vào `mentor_stdout`, rồi grep TOÀN BỘ byte của mọi phản hồi member
 * nhìn thấy. Test này canh một lớp lỗi, không canh một hàm — thêm route mới mà
 * quên serializer thì nó đỏ.
 */
import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { q } from '../db/pool'
import {
  INTEGRATION,
  addTestcases,
  call,
  enroll,
  makeCourse,
  makeItem,
  makeProblem,
  makeUser,
  resetDb,
  setupDb,
  type TestUser,
} from '../testing/harness'
import { toMemberProblem, toMemberResult } from './index'

const CANARY_HIDDEN_INPUT = 'CANARY_HIDDEN_INPUT_9f3a'
const CANARY_HIDDEN_EXPECTED = 'CANARY_HIDDEN_EXPECTED_7c1b'
const CANARY_SOLUTION = 'CANARY_SOLUTION_4e8d'
const CANARY_MENTOR_STDOUT = 'CANARY_MENTOR_STDOUT_2a6f'
/** Harness của bài dạng function: lộ nó là lộ luôn cách bài được kiểm. */
const CANARY_HARNESS = 'CANARY_HARNESS_5b2e'
const ALL_CANARIES = [CANARY_HIDDEN_INPUT, CANARY_HIDDEN_EXPECTED, CANARY_SOLUTION, CANARY_MENTOR_STDOUT, CANARY_HARNESS]

describe.skipIf(!INTEGRATION)('canary — dữ liệu ẩn không bao giờ tới member', () => {
  let member: TestUser
  let mentor: TestUser
  let itemId: string
  let problemId: string
  let submissionId: string

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    member = await makeUser('member')
    mentor = await makeUser('mentor')
    const course = await makeCourse(mentor.id)
    await enroll(course.id, member.id)
    problemId = await makeProblem(mentor.id, {
      solutionSource: `// ${CANARY_SOLUTION}`,
      solutionLanguageId: 'c11',
    })
    await addTestcases(problemId, [
      { input: '1 1\n', expected: '2\n', kind: 'sample' },
      { input: `${CANARY_HIDDEN_INPUT}\n`, expected: `${CANARY_HIDDEN_EXPECTED}\n`, kind: 'hidden' },
    ])
    itemId = await makeItem(course.id, problemId)

    // Một bài nộp đã chấm xong, có kết quả cho CẢ testcase ẩn — kèm mentor_stdout.
    const [sub] = await q<{ id: string }>(sql`
      INSERT INTO submissions (kind, user_id, problem_id, item_id, language_id, source, source_bytes,
                               status, verdict, passed_weight, total_weight, attempt)
      VALUES ('submit', ${member.id}, ${problemId}, ${itemId}, 'c11', 'int main(){}', 12,
              'done', 'WA', 1, 2, 1)
      RETURNING id
    `)
    submissionId = sub!.id
    await q(sql`
      INSERT INTO submission_results (submission_id, attempt, position, is_sample, verdict, time_ms,
                                      memory_kb, exit_code, term_signal, detail, stdout, stderr,
                                      mentor_stdout, first_diff_line)
      VALUES
        (${submissionId}, 1, 1, true,  'AC', 10, 2048, 0, NULL, NULL, '2', '', NULL, NULL),
        (${submissionId}, 1, 2, false, 'WA', 12, 2048, 3, NULL, 'exit_3',
         ${CANARY_HIDDEN_EXPECTED}, ${CANARY_HIDDEN_INPUT}, ${CANARY_MENTOR_STDOUT}, 1)
    `)
  })

  /** Grep thô toàn bộ body — không tin vào việc "chắc là serializer đã lọc". */
  function assertClean(label: string, body: unknown) {
    const text = JSON.stringify(body)
    for (const canary of ALL_CANARIES) {
      expect(text.includes(canary), `${label} rò rỉ ${canary}`).toBe(false)
    }
  }

  it('GET đề bài không lộ testcase ẩn hay lời giải', async () => {
    const res = await call(`/api/member/problems?itemId=${itemId}`, { as: member })
    expect(res.status).toBe(200)
    expect(res.body.data.hiddenTestcaseCount).toBe(1)
    expect(res.body.data.samples).toHaveLength(1)
    assertClean('đề bài', res.body)
  })

  it('GET chi tiết bài nộp: testcase ẩn chỉ có verdict/thời gian/bộ nhớ', async () => {
    const res = await call(`/api/member/submissions/${submissionId}`, { as: member })
    expect(res.status).toBe(200)
    const hidden = res.body.data.results.find((r: { position: number }) => r.position === 2)
    expect(hidden.verdict).toBe('WA')
    expect(hidden.timeMs).toBe(12)
    // Không stdout, không stderr, không diff, KHÔNG exit code (kênh byte điều khiển được).
    expect(hidden.stdout).toBeUndefined()
    expect(hidden.stderr).toBeUndefined()
    expect(hidden.firstDiffLine).toBeUndefined()
    expect(hidden.exitCode).toBeUndefined()
    expect(hidden.detail).toBeNull()
    assertClean('chi tiết bài nộp', res.body)
  })

  it('GET lịch sử bài nộp sạch', async () => {
    const res = await call(`/api/member/submissions?itemId=${itemId}`, { as: member })
    expect(res.status).toBe(200)
    assertClean('lịch sử', res.body)
  })

  it('testcase MẪU vẫn hiện diff đầy đủ (không lọc quá tay)', async () => {
    const res = await call(`/api/member/submissions/${submissionId}`, { as: member })
    const sample = res.body.data.results.find((r: { position: number }) => r.position === 1)
    expect(sample.stdout).toBe('2')
    expect(sample.isSample).toBe(true)
  })

  it('mentor thì thấy đủ — cùng dữ liệu, khác serializer', async () => {
    const res = await call(`/api/mentor/problems/${problemId}`, { as: mentor })
    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body)).toContain(CANARY_SOLUTION)
    expect(JSON.stringify(res.body)).toContain(CANARY_HIDDEN_INPUT)
  })

  it('member không mở được đường mentor của bài', async () => {
    const res = await call(`/api/mentor/problems/${problemId}`, { as: member })
    expect(res.status).toBe(403)
  })

  it('IDOR: member khác không đọc được bài nộp của tôi', async () => {
    const other = await makeUser('member')
    const res = await call(`/api/member/submissions/${submissionId}`, { as: other })
    expect(res.status).toBe(404)
  })

  it('serializer thuần: testcase ẩn không mang exit code kể cả khi DB có', () => {
    const view = toMemberResult({
      position: 9,
      isSample: false,
      verdict: 'RE',
      timeMs: 5,
      memoryKb: 1024,
      exitCode: 42,
      termSignal: 11,
      detail: 'SIGSEGV',
      stdout: CANARY_HIDDEN_EXPECTED,
      stderr: CANARY_HIDDEN_INPUT,
      mentorStdout: CANARY_MENTOR_STDOUT,
      firstDiffLine: 3,
    })
    const text = JSON.stringify(view)
    for (const canary of ALL_CANARIES) expect(text).not.toContain(canary)
    expect(text).not.toContain('42')
    expect(text).not.toContain('SIGSEGV')
  })

  it('serializer thuần: đề bài chỉ mang testcase mẫu', () => {
    const view = toMemberProblem(
      {
        id: 'p', title: 't', kind: 'function', harness: { c11: CANARY_HARNESS },
        statementMd: 's', inputDescMd: null, outputDescMd: null, constraintsMd: null,
        examples: [], timeLimitMs: null, memoryLimitMb: null, difficulty: null, tags: [],
        allowedLanguageIds: null, compareMode: 'trim', floatEps: null, starterCode: {},
        solutionLanguageId: 'c11', solutionSource: CANARY_SOLUTION, solutionVisibility: 'mentor', testcaseRev: 1,
      },
      [
        { id: '1', position: 1, kind: 'sample', weight: 1, input: Buffer.from('a'), expected: Buffer.from('b') },
        {
          id: '2', position: 2, kind: 'hidden', weight: 1,
          input: Buffer.from(CANARY_HIDDEN_INPUT), expected: Buffer.from(CANARY_HIDDEN_EXPECTED),
        },
      ],
      { timeLimitMs: 1000, memoryLimitMb: 256 },
    )
    expect(JSON.stringify(view)).not.toContain(CANARY_HIDDEN_INPUT)
    expect(JSON.stringify(view)).not.toContain(CANARY_SOLUTION)
    // Bài dạng function: harness KHÔNG được đi cùng đề bài sang member.
    expect(JSON.stringify(view)).not.toContain(CANARY_HARNESS)
    expect(view.kind).toBe('function')
    expect(view.hiddenTestcaseCount).toBe(1)
  })
})
