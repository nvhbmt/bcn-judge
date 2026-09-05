/**
 * Dọn container sandbox mồ côi.
 *
 * Bản trước xoá MỌI container mang nhãn `bcnjudge.sandbox=1`, vô điều kiện, ngay lúc
 * worker khởi động. Trên một host chỉ có một worker thì đúng; nhưng deploy blue-green
 * (ADR-11) cho hai worker cùng chạy một lúc, nên worker mới lên sẽ giết ngang container
 * đang chấm dở của worker cũ — mọi bài nộp đang chạy thành IE, ngay giữa lúc deploy.
 *
 * Nên phần đáng canh ở đây không phải "có dọn được rác không" mà là "có tha đúng
 * container của worker còn sống không". Xoá nhầm đắt hơn bỏ sót nhiều lần: rác thì lần
 * khởi động sau nhặt được, còn bài nộp bị giết thì mất hẳn.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

let containers: { Id: string; Labels: Record<string, string> }[] = []
let aliveWorkers: string[] = []
const removed: string[] = []

vi.mock('./sandbox', () => ({
  docker: {
    listContainers: async () => containers,
    getContainer: (id: string) => ({
      remove: async () => {
        removed.push(id)
      },
    }),
  },
}))

vi.mock('@/db/pool', () => ({
  q: async () => aliveWorkers.map((id) => ({ id })),
}))

const { reapOrphanSandboxes } = await import('./reap')

const box = (id: string, worker?: string) => ({
  Id: id,
  Labels: { 'bcnjudge.sandbox': '1', ...(worker ? { 'bcnjudge.worker': worker } : {}) },
})

beforeEach(() => {
  containers = []
  aliveWorkers = []
  removed.length = 0
})

describe('reapOrphanSandboxes', () => {
  it('xoá container của worker đã chết', async () => {
    containers = [box('c1', 'worker-cu')]
    const r = await reapOrphanSandboxes('worker-moi')
    expect(removed).toEqual(['c1'])
    expect(r.removed).toBe(1)
  })

  it('THA container của worker còn sống — đây là ca deploy blue-green', async () => {
    containers = [box('c1', 'worker-xanh')]
    aliveWorkers = ['worker-xanh']
    const r = await reapOrphanSandboxes('worker-luc')
    expect(removed).toEqual([])
    expect(r.kept).toBe(1)
  })

  it('THA container của chính mình, kể cả khi bảng workers chưa kịp có dòng nào', async () => {
    containers = [box('c1', 'toi')]
    aliveWorkers = []
    await reapOrphanSandboxes('toi')
    expect(removed).toEqual([])
  })

  it('THA container không rõ chủ — thà bỏ sót rác còn hơn giết nhầm việc đang chạy', async () => {
    containers = [box('c1')]
    const r = await reapOrphanSandboxes('toi')
    expect(removed).toEqual([])
    expect(r.kept).toBe(1)
  })

  it('phân loại đúng khi có cả ba loại cùng lúc', async () => {
    containers = [box('chet', 'worker-chet'), box('song', 'worker-song'), box('vo-chu')]
    aliveWorkers = ['worker-song']
    const r = await reapOrphanSandboxes('toi')
    expect(removed).toEqual(['chet'])
    expect(r).toEqual({ removed: 1, kept: 2 })
  })

  it('không có container nào thì không hỏi bảng workers làm gì', async () => {
    expect(await reapOrphanSandboxes('toi')).toEqual({ removed: 0, kept: 0 })
  })
})
