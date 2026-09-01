/**
 * Nhịp tim của worker (FR-H3).
 *
 * Test này tồn tại vì một lỗi thật: callback của `setInterval` gọi
 * `void db.execute(sql\`UPDATE workers …\`)`. Builder của drizzle là thenable
 * LƯỜI — nó chỉ gửi câu lệnh khi có ai `await` hoặc `.then()`. `void` vứt object
 * đi, nên câu UPDATE không bao giờ tới Postgres, và vì không ai chờ nên cũng
 * không có lỗi nào để thấy.
 *
 * Hậu quả: `last_seen_at` đứng yên ở thời điểm đăng ký. Sau 30 giây,
 * `/api/admin/judge` trả `alive: false` và trang quản trị báo "Không có worker
 * nào sống — bài nộp đang xếp hàng" trong khi worker vẫn chấm bình thường.
 * Không bộ test nào cũ bắt được vì không bộ nào đợi quá 30 giây rồi mới hỏi.
 */
import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { q } from '../db/pool'
import { INTEGRATION, resetDb, setupDb } from '../testing/harness'
import { touchWorker } from '../worker'

const ID = 'test-worker-heartbeat'

describe.skipIf(!INTEGRATION)('nhịp tim của worker', () => {
  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    await q(sql`
      INSERT INTO workers (id, slots, version, started_at, last_seen_at)
      VALUES (${ID}, 2, 'test', now() - interval '5 minutes', now() - interval '5 minutes')
    `)
  })

  it('đẩy last_seen_at về hiện tại', async () => {
    const before = await q<{ age: number }>(sql`
      SELECT extract(epoch from now() - last_seen_at)::int AS age FROM workers WHERE id = ${ID}
    `)
    expect(before[0]!.age).toBeGreaterThan(60)

    await touchWorker(ID)

    const after = await q<{ age: number }>(sql`
      SELECT extract(epoch from now() - last_seen_at)::int AS age FROM workers WHERE id = ${ID}
    `)
    expect(after[0]!.age).toBeLessThan(5)
  })

  it('sau khi đập nhịp thì worker được coi là còn sống', async () => {
    await touchWorker(ID)

    // Đúng phép so sánh mà /api/admin/judge dùng để tính `alive`.
    const [row] = await q<{ alive: boolean }>(sql`
      SELECT (last_seen_at > now() - interval '30 seconds') AS alive FROM workers WHERE id = ${ID}
    `)
    expect(row!.alive).toBe(true)
  })

  it('worker không tồn tại thì không ném lỗi — worker vừa bị xoá không được làm sập vòng lặp', async () => {
    await expect(touchWorker('khong-co-worker-nay')).resolves.toBeUndefined()
  })
})
