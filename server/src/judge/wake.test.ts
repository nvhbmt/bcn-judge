/**
 * Đánh thức worker khi có việc mới.
 *
 * Điều đáng canh nhất KHÔNG phải "chuông kêu thì thức" mà là "chuông hỏng thì vẫn
 * chạy": đây là tối ưu độ trễ, không phải cơ chế phân phối việc. Nhịp poll phải sống
 * sót qua mọi đường hỏng, nếu không thì một NOTIFY rơi mất biến thành hàng đợi đứng im
 * vĩnh viễn — đắt hơn nhiều so với chính khoản 500 ms mà nó đi tiết kiệm.
 */
import { describe, expect, it, vi } from 'vitest'
import { signalJobReady, wakeAll, waitForJob } from './wake'

describe('waitForJob', () => {
  it('có chuông thì thức NGAY, không đợi hết nhịp poll', async () => {
    const started = Date.now()
    const waiting = waitForJob(5_000)
    // Chuông tới ở nhịp sau, y như NOTIFY về từ Postgres.
    setTimeout(() => wakeAll(), 10)
    await waiting
    expect(Date.now() - started).toBeLessThan(1_000)
  })

  it('không có chuông thì vẫn tự dậy khi hết nhịp — lưới an toàn', async () => {
    const started = Date.now()
    await waitForJob(60)
    expect(Date.now() - started).toBeGreaterThanOrEqual(50)
  })

  it('một hồi chuông đánh thức MỌI slot đang chờ, không phải một cái', async () => {
    const all = [waitForJob(5_000), waitForJob(5_000), waitForJob(5_000)]
    setTimeout(() => wakeAll(), 10)
    // Treo một slot là hụt năng lực chấm mà không có gì báo.
    await expect(Promise.all(all)).resolves.toHaveLength(3)
  })

  it('chuông rung lúc không ai chờ thì rơi vào hư không, không dồn lại', async () => {
    wakeAll()
    // Nhịp poll mới là thứ bắt được việc bị lỡ; hàng đợi ở Postgres, không ở đây.
    const started = Date.now()
    await waitForJob(60)
    expect(Date.now() - started).toBeGreaterThanOrEqual(50)
  })

  it('thức rồi thì không resolve lần hai, và timer được dọn', async () => {
    const spy = vi.spyOn(globalThis, 'clearTimeout')
    const waiting = waitForJob(5_000)
    wakeAll()
    wakeAll()
    await waiting
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('signalJobReady', () => {
  it('bus hỏng thì NUỐT lỗi — lượt nộp vừa ghi xong không được phép đổ vì cái chuông', async () => {
    vi.doMock('../realtime/bus', () => ({
      publish: () => Promise.reject(new Error('mất kết nối LISTEN')),
    }))
    await expect(signalJobReady()).resolves.toBeUndefined()
    vi.doUnmock('../realtime/bus')
  })
})
