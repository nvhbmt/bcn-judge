/**
 * Thảo luận theo bài — trọng tâm là CỔNG chống lộ lời giải:
 *   - chưa AC (và không phải staff) thì canAccess=false, không thấy nội dung, không đăng được;
 *   - AC rồi thì mở; mentor/admin luôn mở (để trả lời/kiểm duyệt);
 *   - tác giả sửa/xoá của mình; staff xoá bất kỳ + ghim.
 */
import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { q } from '@/db/pool'
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
} from '@/testing/harness'

async function ac(userId: string, itemId: string, problemId: string, verdict = 'AC'): Promise<void> {
  await q(sql`
    INSERT INTO submissions (id, kind, user_id, problem_id, item_id, language_id, source, source_bytes,
                             status, verdict, passed_weight, total_weight, received_at, attempt)
    VALUES (gen_random_uuid()::text, 'submit', ${userId}, ${problemId}, ${itemId}, 'c11', 'x', 1,
            'done', ${verdict}, 1, 1, now(), 1)
  `)
}

describe.skipIf(!INTEGRATION)('thảo luận theo bài (/api/member/discussion)', () => {
  let admin: TestUser
  let mentor: TestUser
  let solver: TestUser // sẽ AC
  let stuck: TestUser // chưa AC
  let courseId: string
  let itemId: string
  let pid: string

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    admin = await makeUser('admin')
    mentor = await makeUser('mentor')
    solver = await makeUser('member')
    stuck = await makeUser('member')
    const course = await makeCourse(admin.id, { status: 'open' })
    courseId = course.id
    await enroll(courseId, solver.id)
    await enroll(courseId, stuck.id)
    pid = await makeProblem(admin.id, { scopeCourseId: courseId })
    await addTestcases(pid, [{ input: '1', expected: '1' }])
    itemId = await makeItem(courseId, pid)
    await ac(solver.id, itemId, pid) // solver đã AC
    await ac(stuck.id, itemId, pid, 'WA') // stuck mới WA, chưa AC
  })

  const list = (as: TestUser) => call(`/api/member/discussion/problem/${pid}`, { as })
  const newThread = (as: TestUser, body: unknown) =>
    call(`/api/member/discussion/problem/${pid}`, { as, body })

  it('cổng: chưa AC không mở, AC rồi mở, staff luôn mở', async () => {
    expect((await list(stuck)).body.data).toMatchObject({ canAccess: false, canPost: false })
    expect((await list(solver)).body.data).toMatchObject({ canAccess: true, canPost: true })
    expect((await list(mentor)).body.data).toMatchObject({ canAccess: true, isStaff: true })
    expect((await list(admin)).body.data.canAccess).toBe(true)
  })

  it('chưa AC KHÔNG đăng được; AC rồi đăng được và hiện ra', async () => {
    expect((await newThread(stuck, { title: 'Hỏi', bodyMd: 'giúp mình với' })).status).toBe(403)

    const created = await newThread(solver, { title: 'Tại sao WA?', bodyMd: 'mình bị WA test 3' })
    expect(created.status).toBe(201)
    const threads = (await list(solver)).body.data.threads
    expect(threads).toHaveLength(1)
    expect(threads[0]).toMatchObject({ title: 'Tại sao WA?', isMine: true, canManage: true })
  })

  it('người chưa AC không thấy chủ đề người khác đã đăng; AC xong thì thấy', async () => {
    await newThread(solver, { title: 'Gợi ý', bodyMd: 'dùng long long' })
    expect((await list(stuck)).body.data.threads).toHaveLength(0)
    await ac(stuck.id, itemId, pid) // giờ stuck AC
    const after = (await list(stuck)).body.data
    expect(after.canAccess).toBe(true)
    expect(after.threads).toHaveLength(1)
    expect(after.threads[0].isMine).toBe(false) // của solver
  })

  it('trả lời: AC rồi trả lời được; sửa đặt edited_at; chưa AC thì 403', async () => {
    const tid = (await newThread(solver, { title: 'T', bodyMd: 'B' })).body.data.id
    expect((await call(`/api/member/discussion/thread/${tid}/reply`, { as: stuck, body: { bodyMd: 'x' } })).status).toBe(403)

    const rep = await call(`/api/member/discussion/thread/${tid}/reply`, { as: solver, body: { bodyMd: 'thử test lớn' } })
    expect(rep.status).toBe(201)
    const rid = rep.body.data.id
    expect((await call(`/api/member/discussion/reply/${rid}`, { as: solver, method: 'PATCH', body: { bodyMd: 'đã sửa' } })).status).toBe(200)
    const reply = (await list(solver)).body.data.threads[0].replies[0]
    expect(reply.bodyMd).toBe('đã sửa')
    expect(reply.editedAt).not.toBeNull()
  })

  it('kiểm duyệt: staff xoá bất kỳ (cascade trả lời) và ghim; member thường không', async () => {
    const tid = (await newThread(solver, { title: 'T', bodyMd: 'B' })).body.data.id
    await call(`/api/member/discussion/thread/${tid}/reply`, { as: solver, body: { bodyMd: 'r1' } })

    // member khác không xoá được của người ta
    expect((await call(`/api/member/discussion/thread/${tid}`, { as: stuck, method: 'DELETE' })).status).toBe(403)
    // member không ghim được
    expect((await call(`/api/member/discussion/thread/${tid}/pin`, { as: solver, body: { pinned: true } })).status).toBe(403)
    // mentor ghim được
    expect((await call(`/api/member/discussion/thread/${tid}/pin`, { as: mentor, body: { pinned: true } })).status).toBe(200)

    // mentor xoá được, và trả lời biến mất theo
    expect((await call(`/api/member/discussion/thread/${tid}`, { as: mentor, method: 'DELETE' })).status).toBe(200)
    const [cnt] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM discussion_replies WHERE thread_id = ${tid}`)
    expect(cnt!.n).toBe(0)
  })

  it('ghim nổi lên đầu danh sách', async () => {
    const t1 = (await newThread(solver, { title: 'Cũ', bodyMd: 'B' })).body.data.id
    await newThread(solver, { title: 'Mới', bodyMd: 'B' }) // mới hơn, mặc định lên trước
    await call(`/api/member/discussion/thread/${t1}/pin`, { as: mentor, body: { pinned: true } })
    const titles = (await list(solver)).body.data.threads.map((t: any) => t.title)
    expect(titles[0]).toBe('Cũ') // đã ghim nên lên đầu dù cũ hơn
  })

  it('cấm vận contest (v0.8): bài đang trong contest mở → đóng với member đã AC qua khoá; staff thì không', async () => {
    const [ct] = await q<{ id: string }>(sql`
      INSERT INTO contests (title, course_id, start_at, end_at, status)
      VALUES ('C', NULL, now() - interval '1 hour', now() + interval '5 hours', 'published') RETURNING id`)
    await q(sql`INSERT INTO contest_problems (contest_id, problem_id, position, label, max_score) VALUES (${ct!.id}, ${pid}, 1, 'A', 100)`)

    const res = await list(solver)
    expect(res.body.data).toMatchObject({ canAccess: false, reason: 'contest_embargo', threads: [] })
    expect(res.body.data.embargoUntil).toBeTruthy()
    expect((await newThread(solver, { title: 'Hỏi', bodyMd: 'x' })).status).toBe(403)
    expect((await list(mentor)).body.data.canAccess).toBe(true)

    await q(sql`UPDATE contests SET end_at = now() - interval '1 minute' WHERE id = ${ct!.id}`)
    expect((await list(solver)).body.data).toMatchObject({ canAccess: true, reason: null })
  })
})
