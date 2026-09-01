/**
 * Pool container ấm.
 *
 * Thứ đáng canh nhất KHÔNG phải "có nhanh hơn không" mà là "có phát nhầm container
 * không". Container ấm dựng sẵn với một bộ giới hạn cụ thể; phát nó cho một lượt chấm
 * cần giới hạn khác là bài được biên dịch dưới hạn mức không phải hạn mức mentor đặt —
 * sai âm thầm, không verdict nào tố cáo, không log nào ghi lại.
 *
 * Nên các test dưới đây tập trung vào KHOÁ pool và vòng đời, chạy trên một `Sandbox`
 * giả để không phải dựng Docker thật.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const created: { opts: any; destroyed: boolean }[] = []

vi.mock('./sandbox', () => ({
  Sandbox: {
    create: vi.fn(async (opts: any) => {
      const rec = { opts, destroyed: false }
      created.push(rec)
      return {
        id: `c${created.length}`,
        destroy: async () => {
          rec.destroyed = true
        },
      }
    }),
  },
}))

const { acquire, drainPool, poolStats, resetPoolForTest, sweepPool } = await import('./pool')

const OPTS = { image: 'gcc:13', memoryMb: 1024, maxOutputBytes: 8192, cpus: 1 }

/** `fill` chạy nền — nhường vài nhịp microtask cho nó xong. */
const settle = () => new Promise((r) => setTimeout(r, 5))

beforeEach(() => {
  created.length = 0
  resetPoolForTest()
})

describe('khoá pool', () => {
  it('lượt đầu trượt, lượt sau trúng container đã dựng sẵn', async () => {
    const first = await acquire(OPTS)
    expect(first.warm).toBe(false)
    await settle()
    expect(poolStats().ready).toBe(1)

    const second = await acquire(OPTS)
    expect(second.warm).toBe(true)
    expect(second.sandbox.id).not.toBe(first.sandbox.id)
  })

  it('KHÔNG phát container ấm cho giới hạn bộ nhớ khác', async () => {
    await acquire(OPTS)
    await settle()
    // Mentor đổi hạn mức biên dịch: container ấm dựng theo hạn mức cũ không dùng được.
    const other = await acquire({ ...OPTS, memoryMb: 256 })
    expect(other.warm).toBe(false)
    expect(other.sandbox.id).toBeDefined()
  })

  it('KHÔNG phát container ấm cho cpuset khác — khác slot là khác core được pin', async () => {
    await acquire({ ...OPTS, cpusetCpus: '0' })
    await settle()
    expect((await acquire({ ...OPTS, cpusetCpus: '1' })).warm).toBe(false)
  })

  it('KHÔNG phát container ấm cho image khác', async () => {
    await acquire(OPTS)
    await settle()
    expect((await acquire({ ...OPTS, image: 'python:3.12' })).warm).toBe(false)
  })

  it('nhãn khác nhau vẫn dùng chung được — nhãn không đổi hành vi container', async () => {
    await acquire({ ...OPTS, labels: { 'bcnjudge.submission': 'a' } })
    await settle()
    const hit = await acquire({ ...OPTS, labels: { 'bcnjudge.submission': 'b' } })
    expect(hit.warm).toBe(true)
  })
})

describe('nhãn của container ấm', () => {
  it('mang nhãn chủ sở hữu nhưng KHÔNG mang id bài nộp đã kích hoạt lượt dựng', async () => {
    await acquire({ ...OPTS, labels: { 'bcnjudge.submission': 'bai-1', 'bcnjudge.worker': 'w1' } })
    await settle()
    // created[0] là lượt dựng đồng bộ; created[1] là container ấm dựng nền.
    const pooled = created[1]!.opts.labels
    expect(pooled['bcnjudge.worker']).toBe('w1')
    // Nhãn trỏ sang một bài nộp KHÁC bài sau này dùng container — sai còn tệ hơn thiếu.
    expect(pooled['bcnjudge.submission']).toBeUndefined()
    expect(pooled['bcnjudge.pooled']).toBe('1')
  })
})

describe('vòng đời', () => {
  it('giữ tối đa một container mỗi khoá', async () => {
    await acquire(OPTS)
    await settle()
    await settle()
    expect(poolStats().ready).toBe(1)
  })

  it('quét thả container nằm quá lâu', async () => {
    await acquire(OPTS)
    await settle()
    expect(await sweepPool(Date.now() + 11 * 60_000)).toBe(1)
    expect(poolStats().ready).toBe(0)
  })

  it('quét KHÔNG đụng container còn trong hạn', async () => {
    await acquire(OPTS)
    await settle()
    expect(await sweepPool(Date.now())).toBe(0)
    expect(poolStats().ready).toBe(1)
  })

  it('tắt máy thì huỷ sạch — bỏ qua bước này là mỗi lần tắt để lại một lứa', async () => {
    await acquire(OPTS)
    await settle()
    await drainPool()
    expect(poolStats().ready).toBe(0)
    expect(created.filter((c) => c.destroyed).length).toBeGreaterThan(0)
  })

  it('đã tắt thì không dựng thêm nữa', async () => {
    await drainPool()
    const n = created.length
    await acquire(OPTS).catch(() => null)
    await settle()
    // Vẫn dựng được container cho lượt đang chấm, nhưng KHÔNG mồi thêm cho pool.
    expect(created.length).toBe(n + 1)
    expect(poolStats().ready).toBe(0)
  })
})
