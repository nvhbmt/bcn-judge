/**
 * §4.3: bus LISTEN/NOTIFY. Vòng round-trip phải đi THẬT qua Postgres — mock `pg`
 * ở đây chỉ chứng minh mock chạy đúng, không chứng minh NOTIFY tới nơi, mà "tới
 * nơi" chính là thứ duy nhất ADR-7 đặt cược.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { pool } from '../db/pool'
import { INTEGRATION } from '../testing/harness'
import {
  MAX_PAYLOAD_BYTES,
  busStatus,
  onConnectionLost,
  publish,
  startBus,
  stopBus,
  subscribe,
} from './bus'

describe('bus — sổ subscriber (không cần Postgres)', () => {
  it('busStatus đếm subscriber, unsubscribe idempotent', () => {
    const base = busStatus().subscribers
    const offA = subscribe('t.registry', () => {})
    const offB = subscribe('t.registry', () => {})
    const offC = subscribe('t.registry.khac', () => {})
    expect(busStatus().subscribers).toBe(base + 3)

    offA()
    offA() // gọi hai lần không được trừ hai lần
    expect(busStatus().subscribers).toBe(base + 2)

    offB()
    offC()
    expect(busStatus().subscribers).toBe(base)
  })
})

describe.skipIf(!INTEGRATION)('bus — LISTEN/NOTIFY qua Postgres', () => {
  const offs: Array<() => void> = []

  beforeAll(async () => {
    await startBus()
  })

  afterEach(() => {
    while (offs.length) offs.pop()?.()
  })

  afterAll(async () => {
    await stopBus()
  })

  /** Gom mọi payload của một kênh; tự huỷ đăng ký sau mỗi ca. */
  function collect(channel: string): unknown[] {
    const got: unknown[] = []
    offs.push(subscribe(channel, (p) => got.push(p)))
    return got
  }

  async function waitUntil(cond: () => boolean, ms = 5_000): Promise<void> {
    const deadline = Date.now() + ms
    while (!cond()) {
      if (Date.now() > deadline) throw new Error('hết giờ chờ event từ bus')
      await new Promise((r) => setTimeout(r, 20))
    }
  }

  it('publish → subscribe đi trọn vòng qua Postgres', async () => {
    const got = collect('t.rt')
    await publish('t.rt', { id: 's1', kind: 'result', position: 3, verdict: 'AC' })

    await waitUntil(() => got.length > 0)
    expect(got[0]).toEqual({ id: 's1', kind: 'result', position: 3, verdict: 'AC' })
  })

  it('nhiều subscriber cùng kênh đều nhận', async () => {
    const a = collect('t.fanout')
    const b = collect('t.fanout')
    const c = collect('t.fanout')
    await publish('t.fanout', { kind: 'standings.changed', seq: 42 })

    await waitUntil(() => a.length > 0 && b.length > 0 && c.length > 0)
    expect([a[0], b[0], c[0]]).toEqual([
      { kind: 'standings.changed', seq: 42 },
      { kind: 'standings.changed', seq: 42 },
      { kind: 'standings.changed', seq: 42 },
    ])
  })

  it('kênh khác không nhận nhầm', async () => {
    const mine = collect('t.mine')
    const other = collect('t.other')
    await publish('t.mine', { n: 1 })

    await waitUntil(() => mine.length > 0)
    expect(other).toEqual([])
  })

  it('unsubscribe thì thôi nhận', async () => {
    const dropped: unknown[] = []
    const off = subscribe('t.unsub', (p) => dropped.push(p))
    off()
    const barrier = collect('t.unsub.barrier')

    // Postgres deliver theo đúng thứ tự commit: barrier tới ⇒ event trước nó
    // cũng đã tới. Không cần sleep tuỳ hứng.
    await publish('t.unsub', { n: 1 })
    await publish('t.unsub.barrier', { n: 2 })

    await waitUntil(() => barrier.length > 0)
    expect(dropped).toEqual([])
  })

  it('payload sát ngưỡng vẫn đi nguyên vẹn', async () => {
    const got = collect('t.big')
    const source = 'x'.repeat(MAX_PAYLOAD_BYTES - 200)
    await publish('t.big', { id: 's7', source })

    await waitUntil(() => got.length > 0)
    expect(got[0]).toEqual({ id: 's7', source })
  })

  it('payload quá khổ chỉ phát định danh để client refetch', async () => {
    const got = collect('t.oversize')
    await publish('t.oversize', {
      id: 's9',
      kind: 'done',
      seq: 128,
      final: true,
      stderr: 'y'.repeat(MAX_PAYLOAD_BYTES * 2),
    })

    await waitUntil(() => got.length > 0)
    expect(got[0]).toEqual({ truncated: true, id: 's9', kind: 'done', seq: 128, final: true })
    expect(got[0]).not.toHaveProperty('stderr')
  })

  it('busStatus phản ánh kết nối và mốc event cuối', async () => {
    expect(busStatus().connected).toBe(true)
    const got = collect('t.status')
    const before = busStatus().lastEventAt

    await publish('t.status', { n: 1 })
    await waitUntil(() => got.length > 0)

    const after = busStatus().lastEventAt
    expect(after).not.toBeNull()
    expect(after).not.toBe(before)
    expect(Number.isNaN(Date.parse(after!))).toBe(false)
  })

  // Hai ca cuối đảo trạng thái của cả module — để sau cùng.
  it('stopBus ngắt kết nối, startBus nối lại (cả hai idempotent)', async () => {
    await stopBus()
    await stopBus()
    expect(busStatus().connected).toBe(false)

    await startBus()
    await startBus()
    expect(busStatus().connected).toBe(true)

    // LISTEN được phát lại sau khi nối lại — nếu không, bus im lặng mãi mãi.
    const got = collect('t.relisten')
    await publish('t.relisten', { n: 1 })
    await waitUntil(() => got.length > 0)
    expect(got[0]).toEqual({ n: 1 })
  })

  /**
   * Sửa vòng 2 #10 — lý do chính file bus.ts tồn tại. Connection LISTEN chết là
   * chế độ hỏng CÂM: không ai báo, keep-alive vẫn chạy, SSE đóng băng vĩnh viễn.
   * Ca này giết đúng backend đang LISTEN (như Postgres restart / reset) và đòi:
   * báo mất kết nối → nối lại → LISTEN lại → event chảy tiếp.
   */
  it('backend LISTEN bị giết: báo mất kết nối, nối lại và LISTEN lại', async () => {
    await startBus()
    await waitUntil(() => busStatus().connected)

    let losses = 0
    const offLoss = onConnectionLost(() => losses++)

    const killed = await pool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE query = 'LISTEN bcn_events' AND pid <> pg_backend_pid()`,
    )
    expect(killed.rowCount).toBeGreaterThan(0)

    // (a) stream SSE phải được báo để đóng — không được im lặng chạy tiếp.
    await waitUntil(() => losses > 0)
    expect(busStatus().connected).toBe(false)

    // (b) nối lại có backoff + phát lại LISTEN.
    await waitUntil(() => busStatus().connected, 10_000)
    const got = collect('t.heal')
    await publish('t.heal', { kind: 'standings.changed' })
    await waitUntil(() => got.length > 0)
    expect(got[0]).toEqual({ kind: 'standings.changed' })

    offLoss()
  })
})
