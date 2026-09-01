/**
 * FR-D: trình soạn bài của mentor.
 *
 * Lý do file này tồn tại: `GET /api/mentor/problems/:id` từng ném 500 với MỌI bài
 * đã kiểm lời giải mẫu, vì route gọi `.toISOString()` thẳng lên `validated_at`
 * đọc từ DB — mà node-postgres trả timestamptz về dạng CHUỖI. Lỗi ngủ yên rất
 * lâu vì fixture `makeProblem()` không set `validated_at`, nên cột luôn NULL và
 * `?.` nuốt mất lời gọi. Chỉ tới khi có dữ liệu thật đã validate nó mới nổ, và
 * khi nổ thì cả màn soạn bài trắng — kể cả thẻ Testcase chứa input/output.
 *
 * Vì vậy test ở đây luôn đặt `validated_at` khác NULL.
 */
import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/pool'
import {
  INTEGRATION,
  addTestcases,
  call,
  makeProblem,
  makeUser,
  resetDb,
  setupDb,
  type TestUser,
} from '../testing/harness'

describe.skipIf(!INTEGRATION)('mentor · chi tiết bài tập (FR-D)', () => {
  let mentor: TestUser
  let problemId: string

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    mentor = await makeUser('mentor')
    problemId = await makeProblem(mentor.id, { title: 'Tổng hai số' })
    await addTestcases(problemId, [
      { input: '3 5\n', expected: '8\n', kind: 'sample' },
      { input: '-2 7\n', expected: '5\n', kind: 'sample' },
      { input: '0 0\n', expected: '0\n', kind: 'hidden' },
    ])
  })

  /** Đánh dấu bài đã kiểm — đúng trạng thái mà seed dữ liệu mẫu tạo ra. */
  async function markValidated(): Promise<void> {
    await db.execute(sql`
      UPDATE problems SET validated_testcase_rev = testcase_rev, validated_at = now() WHERE id = ${problemId}
    `)
  }

  it('mở được bài ĐÃ KIỂM và trả validatedAt dạng chuỗi ISO', async () => {
    await markValidated()

    const res = await call(`/api/mentor/problems/${problemId}`, { as: mentor })

    expect(res.status).toBe(200)
    expect(res.body.meta.validated).toBe(true)
    expect(typeof res.body.meta.validatedAt).toBe('string')
    // Phải parse được, và phải là ISO thật chứ không phải chuỗi thô của Postgres.
    expect(new Date(res.body.meta.validatedAt).getTime()).not.toBeNaN()
    expect(res.body.meta.validatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/)
  })

  it('bài CHƯA kiểm trả validatedAt null, không ném lỗi', async () => {
    const res = await call(`/api/mentor/problems/${problemId}`, { as: mentor })

    expect(res.status).toBe(200)
    expect(res.body.meta.validated).toBe(false)
    expect(res.body.meta.validatedAt).toBeNull()
  })

  it('mentor thấy đầy đủ input/output của mọi testcase, kể cả test ẩn', async () => {
    await markValidated()

    const res = await call(`/api/mentor/problems/${problemId}`, { as: mentor })

    expect(res.status).toBe(200)
    const tcs = res.body.data.testcases
    expect(tcs).toHaveLength(3)
    expect(tcs.map((t: { kind: string }) => t.kind)).toEqual(['sample', 'sample', 'hidden'])
    // Đây là nội dung mà thẻ Testcase dựng bảng từ đó; rỗng là màn hình trắng.
    expect(tcs[0].inputPreview).toBe('3 5\n')
    expect(tcs[0].expectedPreview).toBe('8\n')
    expect(tcs[2].inputPreview).toBe('0 0\n')
    expect(tcs[2].expectedPreview).toBe('0\n')
  })
})

/**
 * Trường được zod nhận thì PHẢI được ghi xuống DB.
 *
 * Hai lỗi thật ở đây, cùng một họ "nhận rồi vứt im lặng":
 *  - `POST /api/mentor/problems` nhận 20 trường nhưng INSERT chỉ có 14; sáu cột
 *    (examples, tags, allowed_language_ids, float_eps, starter_code,
 *    solution_visibility) mất sạch. Lần trước chỉ soi PATCH nên POST lọt lưới.
 *  - `PATCH` có cột `tags` nhưng nội suy mảng JS rồi ép ::text[]; drizzle bung
 *    mảng thành hai tham số nên Postgres ném lỗi và route trả 500 — tags chưa
 *    bao giờ đặt được, dù FR-D1 bắt buộc.
 */
describe.skipIf(!INTEGRATION)('mentor · bài tập giữ đủ trường (FR-D1)', () => {
  let mentor: TestUser

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    mentor = await makeUser('mentor')
  })

  const FULL = {
    title: 'Bài đủ trường',
    statementMd: 'Đề bài',
    tags: ['số học', 'chuỗi'],
    examples: [{ input: '1 2\n', output: '3\n', explanation: 'cộng lại' }],
    allowedLanguageIds: ['c11', 'python3'],
    compareMode: 'float' as const,
    floatEps: 0.001,
    starterCode: { c11: 'int f(void){ return 0; }\n' },
    solutionVisibility: 'after_ac' as const,
  }

  it('tạo bài giữ đủ cả sáu trường từng bị INSERT bỏ quên', async () => {
    const res = await call('/api/mentor/problems', { as: mentor, body: FULL })
    expect(res.status).toBe(201)

    const got = await call(`/api/mentor/problems/${res.body.data.id}`, { as: mentor })
    expect(got.status).toBe(200)
    expect(got.body.data.tags).toEqual(['số học', 'chuỗi'])
    expect(got.body.data.examples).toEqual(FULL.examples)
    expect(got.body.data.allowedLanguageIds).toEqual(['c11', 'python3'])
    expect(got.body.data.starterCode).toEqual(FULL.starterCode)
    expect(got.body.data.solutionVisibility).toBe('after_ac')
    expect(got.body.data.compareMode).toBe('float')
  })

  it('sửa tags trả 200 và ghi đúng, không phải 500', async () => {
    const made = await call('/api/mentor/problems', { as: mentor, body: { title: 'T', statementMd: 'x' } })
    const id = made.body.data.id

    const patched = await call(`/api/mentor/problems/${id}`, {
      as: mentor,
      method: 'PATCH',
      body: { tags: ['quy hoạch động'], allowedLanguageIds: ['cpp17'] },
    })

    expect(patched.status).toBe(200)
    const got = await call(`/api/mentor/problems/${id}`, { as: mentor })
    expect(got.body.data.tags).toEqual(['quy hoạch động'])
    expect(got.body.data.allowedLanguageIds).toEqual(['cpp17'])
  })

  it('không gửi tags thì tags cũ giữ nguyên, không bị xoá trắng', async () => {
    const made = await call('/api/mentor/problems', { as: mentor, body: { title: 'T', statementMd: 'x', tags: ['giữ nguyên'] } })
    const id = made.body.data.id

    await call(`/api/mentor/problems/${id}`, { as: mentor, method: 'PATCH', body: { title: 'Tên mới' } })

    const got = await call(`/api/mentor/problems/${id}`, { as: mentor })
    expect(got.body.data.tags).toEqual(['giữ nguyên'])
    expect(got.body.data.title).toBe('Tên mới')
  })
})
