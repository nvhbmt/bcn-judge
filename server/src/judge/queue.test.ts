/**
 * Hàng đợi (§4.2) + chấm end-to-end qua DB.
 *
 * Các ca chạy container thật cần cả INTEGRATION=1 lẫn DOCKER=1.
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
import { claimNext, enqueue, finish, heartbeat, purgeOld, queueStats, reapStale } from './queue'

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

  describe.skipIf(!DOCKER)('chấm thật qua hàng đợi (Docker)', () => {
    it('nộp qua API → worker chấm → AC với điểm 100', async () => {
      const posted = await call('/api/member/submissions', {
        as: member,
        body: { itemId, languageId: 'c11', source: AC_SOURCE },
      })
      expect(posted.status).toBe(201)
      const id = posted.body.data.id

      const { processOneJob } = await import('../worker')
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
      const { processOneJob } = await import('../worker')
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

      const { processOneJob } = await import('../worker')
      await processOneJob(0)

      const [row] = await q<{ validated_testcase_rev: number | null; testcase_rev: number }>(sql`
        SELECT validated_testcase_rev, testcase_rev FROM problems WHERE id = ${problemId}
      `)
      expect(row?.validated_testcase_rev).toBe(row?.testcase_rev)
    })
  })
})
