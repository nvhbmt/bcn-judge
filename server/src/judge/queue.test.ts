/**
 * Hàng đợi (§4.2) + chấm end-to-end qua DB.
 *
 * Các ca chạy container thật cần cả INTEGRATION=1 lẫn DOCKER=1.
 */
import { readFileSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
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
  assignMentor,
  type TestUser,
} from '@/testing/harness'
import { drainPool } from './pool'
import {
  claimNext,
  claimRejudge,
  enqueue,
  enqueueRejudgeForProblem,
  finish,
  finishRejudge,
  healIeOnStartup,
  healIePeriodic,
  heartbeat,
  purgeOld,
  queueStats,
  reapRejudge,
  reapStale,
  rejudgeQueueDepth,
  retryIeSubmissions,
} from './queue'

const DOCKER = process.env.DOCKER === '1'

const AC_SOURCE = `#include <stdio.h>
int main(void){ long long a,b; if(scanf("%lld %lld",&a,&b)!=2) return 1; printf("%lld\\n",a+b); return 0; }
`

describe.skipIf(!INTEGRATION)('hàng đợi chấm bài', () => {
  let member: TestUser
  let mentor: TestUser
  let problemId: string
  let itemId: string

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    mentor = await makeUser('mentor')
    member = await makeUser('member')
    const course = await makeCourse(mentor.id)
    await assignMentor(course.id, mentor.id)
    await enroll(course.id, member.id)
    problemId = await makeProblem(mentor.id)
    await addTestcases(problemId, [
      { input: '1 2\n', expected: '3\n', kind: 'sample' },
      { input: '10 20\n', expected: '30\n', kind: 'hidden' },
    ])
    itemId = await makeItem(course.id, problemId)
  })

  const submit = (source = AC_SOURCE) =>
    enqueue({ kind: 'submit', userId: member.id, problemId, itemId, languageId: 'c11', source })

  it('nộp bài vào hàng đợi ở trạng thái pending', async () => {
    const res = await submit()
    expect(res.ok).toBe(true)
    const stats = await queueStats()
    expect(stats.pendingSubmit).toBe(1)
  })

  it('FR-F5: quá 6 lượt nộp mỗi phút thì bị từ chối', async () => {
    for (let i = 0; i < 6; i++) {
      // Chấm xong ngay để không đụng trần PENDING trước trần nhịp độ.
      const r = await submit()
      if (r.ok) await q(sql`UPDATE submissions SET status = 'done', verdict = 'AC' WHERE id = ${r.id}`)
    }
    const seventh = await submit()
    expect(seventh.ok).toBe(false)
    if (!seventh.ok) expect(seventh.code).toBe('submit_rate_limited')
  })

  it('FR-F5 v0.5: tối đa 3 bài PENDING mỗi người', async () => {
    for (let i = 0; i < 3; i++) expect((await submit()).ok).toBe(true)
    const fourth = await submit()
    expect(fourth.ok).toBe(false)
    if (!fourth.ok) expect(fourth.code).toBe('pending_limit_exceeded')
  })

  it('source vượt trần bị chặn ngay, không vào hàng đợi', async () => {
    const res = await submit('x'.repeat(70_000))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe('source_too_large')
    expect((await queueStats()).pendingSubmit).toBe(0)
  })

  it('lượt chạy thử mới thay thế lượt đang chờ của chính mình', async () => {
    const first = await enqueue({
      kind: 'run', userId: member.id, problemId, itemId, languageId: 'c11',
      source: AC_SOURCE, runTarget: 'samples',
    })
    const second = await enqueue({
      kind: 'run', userId: member.id, problemId, itemId, languageId: 'c11',
      source: AC_SOURCE, runTarget: 'samples',
    })
    expect(first.ok && second.ok).toBe(true)
    const stats = await queueStats()
    expect(stats.pendingRun).toBe(1)
  })

  it('claim: mỗi người CHỈ một việc đang chạy mỗi loại', async () => {
    await submit()
    await submit()
    const first = await claimNext('w1', 0)
    const second = await claimNext('w2', 0)
    expect(first).not.toBeNull()
    expect(second).toBeNull() // bài thứ hai của cùng người phải đợi
  })

  it('claim: hai worker không bao giờ nhận cùng một bài (SKIP LOCKED)', async () => {
    const other = await makeUser('member')
    const course = await makeCourse(mentor.id)
    await enroll(course.id, other.id)
    await enqueue({ kind: 'submit', userId: other.id, problemId, itemId, languageId: 'c11', source: AC_SOURCE })
    await submit()

    const [a, b] = await Promise.all([claimNext('w1', 0), claimNext('w2', 0)])
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(a!.id).not.toBe(b!.id)
  })

  it('slot 0 ưu tiên bài NỘP hơn chạy thử', async () => {
    await enqueue({
      kind: 'run', userId: member.id, problemId, itemId, languageId: 'c11',
      source: AC_SOURCE, runTarget: 'samples',
    })
    await submit()
    const job = await claimNext('w1', 0)
    expect(job?.kind).toBe('submit')
  })

  it('fencing: worker cũ không ghi đè kết quả sau khi bị reaper thu hồi', async () => {
    const res = await submit()
    if (!res.ok) throw new Error('enqueue thất bại')
    const job = await claimNext('w1', 0)
    expect(job).not.toBeNull()

    // Reaper thu hồi: attempt tăng khi worker khác claim lại.
    await q(sql`UPDATE submissions SET status='pending', worker_id=NULL WHERE id = ${res.id}`)
    const retaken = await claimNext('w2', 0)
    expect(retaken?.attempt).toBe(2)

    const wrote = await finish(res.id, 'w1', job!.attempt, {
      verdict: 'AC', passedWeight: 2, totalWeight: 2, timeMsMax: 1, memoryKbMax: 1,
      compileOutput: '', judgeMs: 1, ieReason: null, testcaseRev: 1, results: [],
    })
    expect(wrote).toBe(false) // attempt cũ không được phép ghi
  })

  it('heartbeat chỉ nhận đúng worker và đúng attempt', async () => {
    const res = await submit()
    if (!res.ok) throw new Error('enqueue thất bại')
    const job = await claimNext('w1', 0)
    expect(await heartbeat(res.id, 'w1', job!.attempt)).toBe(true)
    expect(await heartbeat(res.id, 'w2', job!.attempt)).toBe(false)
    expect(await heartbeat(res.id, 'w1', job!.attempt + 5)).toBe(false)
  })

  it('reaper trả bài về hàng đợi khi worker mất nhịp tim', async () => {
    const res = await submit()
    if (!res.ok) throw new Error('enqueue thất bại')
    await claimNext('w1', 0)
    await q(sql`UPDATE submissions SET heartbeat_at = now() - interval '10 minutes' WHERE id = ${res.id}`)

    const reaped = await reapStale()
    expect(reaped.requeued).toBe(1)
    const [row] = await q<{ status: string }>(sql`SELECT status FROM submissions WHERE id = ${res.id}`)
    expect(row?.status).toBe('pending')
  })

  it('dọn run cũ hơn 24 giờ, giữ bài nộp', async () => {
    const run = await enqueue({
      kind: 'run', userId: member.id, problemId, itemId, languageId: 'c11',
      source: AC_SOURCE, runTarget: 'samples',
    })
    const sub = await submit()
    if (!run.ok || !sub.ok) throw new Error('enqueue thất bại')
    await q(sql`UPDATE submissions SET received_at = now() - interval '2 days'`)

    const purged = await purgeOld()
    expect(purged.runs).toBe(1)
    const [remaining] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM submissions`)
    expect(remaining?.n).toBe(1)
  })

  describe('chấm lại (FR-D9)', () => {
    async function doneSubmission(verdict = 'WA', passed = 1) {
      const [row] = await q<{ id: string }>(sql`
        INSERT INTO submissions (kind, user_id, problem_id, item_id, language_id, source, source_bytes,
                                 status, verdict, passed_weight, total_weight, attempt, testcase_rev)
        VALUES ('submit', ${member.id}, ${problemId}, ${itemId}, 'c11', ${AC_SOURCE}, 100,
                'done', ${verdict}, ${passed}, 2, 1, 1)
        RETURNING id
      `)
      await q(sql`
        INSERT INTO submission_results (submission_id, attempt, position, is_sample, verdict)
        VALUES (${row!.id}, 1, 1, true, ${verdict})
      `)
      return row!.id
    }

    it('chỉ xếp hàng bài nộp đã chấm xong, không đụng run hay bài đang chờ', async () => {
      const done = await doneSubmission()
      await enqueue({ kind: 'run', userId: member.id, problemId, itemId, languageId: 'c11', source: AC_SOURCE, runTarget: 'samples' })
      await submit()

      const queued = await enqueueRejudgeForProblem(problemId, mentor.id, 'test')
      expect(queued).toBe(1)
      expect(await rejudgeQueueDepth()).toBe(1)
      const [row] = await q<{ submission_id: string }>(sql`SELECT submission_id FROM rejudge_queue`)
      expect(row?.submission_id).toBe(done)
    })

    it('KHÔNG nhận việc chấm lại khi còn bài nộp/chạy thử đang chờ', async () => {
      await doneSubmission()
      await enqueueRejudgeForProblem(problemId, mentor.id, 'test')
      await submit() // có việc của member đang chờ
      expect(await claimRejudge('w1')).toBeNull()
    })

    it('nhận việc khi rảnh, cấp shadow attempt = attempt hiện tại + 1', async () => {
      const id = await doneSubmission()
      await enqueueRejudgeForProblem(problemId, mentor.id, 'test')
      const job = await claimRejudge('w1')
      expect(job?.id).toBe(id)
      expect(job?.shadowAttempt).toBe(2)
      // Bài nộp KHÔNG rời trạng thái done — bảng xếp hạng không mất dòng.
      const [row] = await q<{ status: string }>(sql`SELECT status FROM submissions WHERE id = ${id}`)
      expect(row?.status).toBe('done')
    })

    it('chốt hạ: hoán đổi verdict, GIỮ kết quả cũ, ghi audit', async () => {
      const id = await doneSubmission('WA', 1)
      await enqueueRejudgeForProblem(problemId, mentor.id, 'rejudge:testcase_rev 1→2')
      const job = await claimRejudge('w1')

      const ok = await finishRejudge(id, 'w1', job!.shadowAttempt, {
        verdict: 'AC', passedWeight: 2, totalWeight: 2, timeMsMax: 5, memoryKbMax: 1024,
        compileOutput: '', judgeMs: 10, ieReason: null, testcaseRev: 2,
        results: [{ position: 1, testcaseId: null, isSample: true, verdict: 'AC', timeMs: 5, memoryKb: 1024,
                    exitCode: 0, termSignal: null, detail: null, stdout: null, stderr: null,
                    mentorStdout: null, firstDiffLine: null }],
      })
      expect(ok).toBe(true)

      const [after] = await q<{ verdict: string; attempt: number; status: string }>(sql`
        SELECT verdict, attempt, status FROM submissions WHERE id = ${id}
      `)
      expect(after?.verdict).toBe('AC')
      expect(after?.attempt).toBe(2)
      expect(after?.status).toBe('done')

      // FR-D9: kết quả TRƯỚC rejudge còn nguyên trong lịch sử.
      const attempts = await q<{ attempt: number; verdict: string }>(sql`
        SELECT attempt, verdict FROM submission_results WHERE submission_id = ${id} ORDER BY attempt
      `)
      expect(attempts.map((a) => `${a.attempt}:${a.verdict}`)).toEqual(['1:WA', '2:AC'])

      const [audit] = await q<{ verdict_before: string; verdict_after: string; reason: string }>(sql`
        SELECT verdict_before, verdict_after, reason FROM submission_score_audit WHERE submission_id = ${id}
      `)
      expect(audit?.verdict_before).toBe('WA')
      expect(audit?.verdict_after).toBe('AC')
      expect(audit?.reason).toContain('testcase_rev')
      expect(await rejudgeQueueDepth()).toBe(0)
    })

    it('fencing: worker khác không chốt hạ hộ được', async () => {
      const id = await doneSubmission()
      await enqueueRejudgeForProblem(problemId, mentor.id, 'test')
      const job = await claimRejudge('w1')
      const stolen = await finishRejudge(id, 'w2', job!.shadowAttempt, {
        verdict: 'AC', passedWeight: 2, totalWeight: 2, timeMsMax: 1, memoryKbMax: 1,
        compileOutput: '', judgeMs: 1, ieReason: null, testcaseRev: 2, results: [],
      })
      expect(stolen).toBe(false)
    })

    it('reaper nhả claim của worker đã chết', async () => {
      await doneSubmission()
      await enqueueRejudgeForProblem(problemId, mentor.id, 'test')
      await claimRejudge('worker-da-chet')
      await q(sql`UPDATE rejudge_queue SET claimed_at = now() - interval '10 minutes'`)

      expect(await reapRejudge()).toBe(1)
      const job = await claimRejudge('w2')
      expect(job).not.toBeNull() // nhặt lại được, không mất việc
    })

    it('API: chấm lại đòi xác nhận vì nó đổi điểm của người khác', async () => {
      await doneSubmission()
      const first = await call(`/api/mentor/problems/${problemId}/rejudge`, { as: mentor, body: {} })
      expect(first.status).toBe(409)
      expect(first.body.error.code).toBe('rejudge_confirm_required')
      expect(first.body.error.details.total).toBe(1)

      const confirmed = await call(`/api/mentor/problems/${problemId}/rejudge`, { as: mentor, body: { confirm: true } })
      expect(confirmed.status).toBe(200)
      expect(confirmed.body.data.queued).toBe(1)
    })
  })

  describe.skipIf(!DOCKER)('chấm thật qua hàng đợi (Docker)', () => {
    // Xả bể container ấm khi xong: processOneJob nuôi bể y như worker thật, mà test
    // thì không có reaper dọn sau lưng — thiếu dòng này thì mỗi lượt chạy để lại
    // một container Up, và phép đếm vệ sinh của sandbox.test (chạy song song ở
    // tiến trình khác) không với tới được bể của tiến trình này.
    afterAll(() => drainPool())


    it('nộp qua API → worker chấm → AC với điểm 100', async () => {
      const posted = await call('/api/member/submissions', {
        as: member,
        body: { itemId, languageId: 'c11', source: AC_SOURCE },
      })
      expect(posted.status).toBe(201)
      const id = posted.body.data.id

      const { processOneJob } = await import('@/worker')
      const job = await processOneJob(0)
      expect(job?.id).toBe(id)

      const detail = await call(`/api/member/submissions/${id}`, { as: member })
      expect(detail.body.data.verdict).toBe('AC')
      expect(detail.body.data.score).toBe(100)
      expect(detail.body.data.results).toHaveLength(2)
      // Testcase ẩn vẫn không lộ gì thêm.
      expect(detail.body.data.results[1].stdout).toBeUndefined()
    })

    it('lời giải sai → WA, điểm theo trọng số testcase đúng', async () => {
      const wrong = AC_SOURCE.replace('a+b', 'a-b')
      const posted = await call('/api/member/submissions', {
        as: member,
        body: { itemId, languageId: 'c11', source: wrong },
      })
      const { processOneJob } = await import('@/worker')
      await processOneJob(0)

      const detail = await call(`/api/member/submissions/${posted.body.data.id}`, { as: member })
      expect(detail.body.data.verdict).toBe('WA')
      expect(detail.body.data.score).toBe(0)
    })

    it('FR-D6: validate bằng lời giải mẫu ghi mốc đã kiểm', async () => {
      await q(sql`
        UPDATE problems SET solution_source = ${AC_SOURCE}, solution_language_id = 'c11' WHERE id = ${problemId}
      `)
      const res = await call(`/api/mentor/problems/${problemId}/validate`, { as: mentor, body: {} })
      expect(res.status).toBe(201)

      const { processOneJob } = await import('@/worker')
      await processOneJob(0)

      const [row] = await q<{ validated_testcase_rev: number | null; testcase_rev: number }>(sql`
        SELECT validated_testcase_rev, testcase_rev FROM problems WHERE id = ${problemId}
      `)
      expect(row?.validated_testcase_rev).toBe(row?.testcase_rev)
    })
  })
})

/**
 * FR-F8 — IE tự chấm lại. Nợ ghi từ 01.09: `retryIeSubmissions` có mà không ai gọi ngoài
 * nút admin, nên một bài IE nằm IE vĩnh viễn nếu không ai để ý. Bộ này canh cả ba đường
 * (khởi động / định kỳ / admin) VÀ canh việc worker thật sự gọi chúng — chính lớp lỗi
 * "hàm tồn tại nhưng không ai gọi" là thứ đã xảy ra.
 */
describe('FR-F8 — worker phải gọi bộ tự lành', () => {
  it('startWorker gọi healIeOnStartup lúc khởi động và healIePeriodic theo nhịp', () => {
    const src = readFileSync(new URL('../worker.ts', import.meta.url), 'utf8')
    expect(src).toContain('await healIeOnStartup()')
    expect(src).toContain('healIePeriodic()')
  })
})

describe.skipIf(!INTEGRATION)('FR-F8 — IE tự chấm lại', () => {
  let member: TestUser
  let problemId: string
  let itemId: string

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    const mentor = await makeUser('mentor')
    member = await makeUser('member')
    const course = await makeCourse(mentor.id)
    await enroll(course.id, member.id)
    problemId = await makeProblem(mentor.id)
    await addTestcases(problemId, [{ input: '1 2\n', expected: '3\n', kind: 'sample' }])
    itemId = await makeItem(course.id, problemId)
  })

  /** Một bài đã IE với attempt/lý do/mốc giờ cho trước. */
  async function ie(o: {
    attempt?: number
    retry?: boolean
    reason?: string
    finishedAgo?: string
    receivedAgo?: string
  } = {}): Promise<string> {
    const r = await enqueue({ kind: 'submit', userId: member.id, problemId, itemId, languageId: 'c11', source: AC_SOURCE })
    if (!r.ok) throw new Error(r.code)
    await q(sql`
      UPDATE submissions
      SET status = 'done', verdict = 'IE', ie_reason = ${o.reason ?? 'no_meta'}, ie_retry = ${o.retry ?? true},
          attempt = ${o.attempt ?? 1},
          finished_at = now() - ${o.finishedAgo ?? '10 minutes'}::interval,
          received_at = now() - ${o.receivedAgo ?? '10 minutes'}::interval
      WHERE id = ${r.id}`)
    return r.id
  }
  const st = async (id: string) =>
    (
      await q<{ status: string; verdict: string | null; attempt: number; retry: boolean; reason: string | null }>(
        sql`SELECT status, verdict, attempt, ie_retry AS retry, ie_reason AS reason FROM submissions WHERE id = ${id}`,
      )
    )[0]!

  it('khởi động: xếp lại mọi IE còn ie_retry trong 24 h — kể cả stale_heartbeat attempt ≥ 3 — và GIỮ attempt', async () => {
    const stale = await ie({ attempt: 3, reason: 'stale_heartbeat' })
    const flake = await ie({ attempt: 1 })
    const poison = await ie({ retry: false, attempt: 3 })
    const cu = await ie({ receivedAgo: '30 hours' })

    expect(await healIeOnStartup()).toBe(2)
    expect(await st(stale)).toMatchObject({ status: 'pending', verdict: null, reason: null, attempt: 3 })
    expect(await st(flake)).toMatchObject({ status: 'pending', verdict: null, attempt: 1 })
    expect(await st(poison)).toMatchObject({ status: 'done', verdict: 'IE' })
    expect(await st(cu)).toMatchObject({ status: 'done', verdict: 'IE' })
  })

  it('định kỳ: chỉ bài xong hơn 2 phút với attempt < 3; attempt ≥ 3 không phải stale thì hạ ie_retry', async () => {
    const vuaXong = await ie({ attempt: 1, finishedAgo: '30 seconds' })
    const flake = await ie({ attempt: 2 })
    const poison = await ie({ attempt: 3, reason: 'exec_failed' })
    const stale = await ie({ attempt: 3, reason: 'stale_heartbeat' })

    expect(await healIePeriodic()).toEqual({ requeued: 1, demoted: 1 })
    expect(await st(flake)).toMatchObject({ status: 'pending', attempt: 2 })
    // Vừa IE xong: chưa bắt lại — chờ đủ 2 phút.
    expect(await st(vuaXong)).toMatchObject({ status: 'done', verdict: 'IE', retry: true })
    // Poison: nằm yên, hết tự chấm lại, chờ admin.
    expect(await st(poison)).toMatchObject({ status: 'done', verdict: 'IE', retry: false })
    // Worker chết giữa chừng thì không phải lỗi của bài — giữ ie_retry cho lần khởi động sau.
    expect(await st(stale)).toMatchObject({ status: 'done', verdict: 'IE', retry: true })
    expect(await healIeOnStartup()).toBe(2) // stale + vuaXong; poison đã bị hạ
    expect(await st(stale)).toMatchObject({ status: 'pending' })
    expect(await st(poison)).toMatchObject({ status: 'done' })

    // Chạy lại lần nữa không có gì để làm — idempotent.
    expect(await healIePeriodic()).toEqual({ requeued: 0, demoted: 0 })
  })

  it('bị hạ ie_retry ba lần liên tiếp là ngưỡng: lần chấm thứ tư chỉ đến từ nút admin', async () => {
    const poison = await ie({ attempt: 3 })
    await healIePeriodic()
    expect((await st(poison)).retry).toBe(false)
    expect(await healIeOnStartup()).toBe(0)
    expect(await retryIeSubmissions(48)).toBe(1)
    expect(await st(poison)).toMatchObject({ status: 'pending', attempt: 3 })
    // Bài quá cửa sổ giờ của nút thì không.
    const cu = await ie({ retry: false, receivedAgo: '60 hours' })
    expect(await retryIeSubmissions(48)).toBe(0)
    expect((await st(cu)).status).toBe('done')
  })

  it('bài xếp lại được claim với attempt TĂNG TIẾP — kết quả cũ trong submission_results không bị nuốt', async () => {
    const id = await ie({ attempt: 2 })
    // Kết quả của lần chấm cũ (attempt 2) nằm sẵn trong bảng — về attempt 0 rồi claim thành
    // 1, 2 là INSERT mới đụng PK và bị DO NOTHING nuốt mất.
    await q(sql`
      INSERT INTO submission_results (submission_id, attempt, position, is_sample, verdict)
      VALUES (${id}, 2, 1, true, 'IE')`)
    await healIeOnStartup()
    const job = await claimNext('w-test', 0)
    expect(job?.id).toBe(id)
    expect(job?.attempt).toBe(3)
    const ok = await finish(id, 'w-test', 3, {
      verdict: 'AC',
      passedWeight: 1,
      totalWeight: 1,
      timeMsMax: 5,
      memoryKbMax: 100,
      compileOutput: '',
      judgeMs: 5,
      ieReason: null,
      testcaseRev: null,
      results: [
        {
          position: 1, testcaseId: null, isSample: true, verdict: 'AC', timeMs: 5, memoryKb: 100,
          exitCode: 0, termSignal: null, detail: null, stdout: '3', stderr: null, mentorStdout: null, firstDiffLine: null,
        },
      ],
    })
    expect(ok).toBe(true)
    const rows = await q<{ attempt: number; verdict: string }>(
      sql`SELECT attempt, verdict FROM submission_results WHERE submission_id = ${id} ORDER BY attempt`,
    )
    expect(rows).toEqual([
      { attempt: 2, verdict: 'IE' },
      { attempt: 3, verdict: 'AC' },
    ])
    expect(await st(id)).toMatchObject({ status: 'done', verdict: 'AC', reason: null })
  })
})
