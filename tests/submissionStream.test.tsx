/**
 * FR-F4 — verdict cập nhật trực tiếp qua SSE.
 *
 * Test này canh đúng một lỗi CÂM: máy chủ gửi sự kiện CÓ TÊN (`sse.ts` đặt tên bằng
 * `payload.kind`, thiếu thì rơi về tên kênh), mà `EventSource.onmessage` chỉ nổ với sự
 * kiện KHÔNG tên. Bản trước chỉ gắn `onmessage`, nên trình duyệt không nhận được gì —
 * và không ai biết, vì đường lùi polling 2 giây vẫn đưa verdict về, chỉ chậm hơn.
 *
 * Đo lúc phát hiện: worker chấm xong ở ~520 ms, giao diện tới ~6070 ms mới biết — đúng
 * bằng 4 giây chờ ân hạn cộng một nhịp poll. Nên phép đo ở đây là "sự kiện MANG TÊN
 * KÊNH có kích hoạt tải lại không", chứ không phải "cuối cùng có ra verdict không":
 * câu hỏi thứ hai vẫn trả lời đúng ngay cả khi SSE chết hẳn.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSubmissionStream } from '@/hooks/useSubmissionStream'

const ID = '11111111-2222-3333-4444-555555555555'

const get = vi.fn()
vi.mock('@/lib/api', () => ({ api: { get: (...a: unknown[]) => get(...a) } }))

/** EventSource giả: jsdom không có, và ta cần bắn được sự kiện có tên. */
class FakeEventSource {
  static last: FakeEventSource | null = null
  onmessage: (() => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  private named = new Map<string, (() => void)[]>()

  constructor(readonly url: string) {
    FakeEventSource.last = this
  }
  addEventListener(name: string, fn: () => void) {
    this.named.set(name, [...(this.named.get(name) ?? []), fn])
  }
  close() {
    this.closed = true
  }
  /** Máy chủ đẩy một sự kiện MANG TÊN, y như thật. */
  emitNamed(name: string) {
    for (const fn of this.named.get(name) ?? []) fn()
  }
}

beforeEach(() => {
  vi.stubGlobal('EventSource', FakeEventSource)
  FakeEventSource.last = null
  get.mockReset()
  get.mockResolvedValue({ id: ID, status: 'running', verdict: null })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useSubmissionStream', () => {
  it('sự kiện mang TÊN KÊNH phải kích hoạt tải lại — onmessage không đủ', async () => {
    renderHook(() => useSubmissionStream(ID))
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1)) // lần nạp đầu

    get.mockResolvedValue({ id: ID, status: 'done', verdict: 'AC' })
    FakeEventSource.last!.emitNamed(`submission:${ID}`)

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
  })

  it('nhận verdict rồi thì đóng kết nối, không để treo tới lúc rời trang', async () => {
    const { result } = renderHook(() => useSubmissionStream(ID))
    await waitFor(() => expect(get).toHaveBeenCalled())

    get.mockResolvedValue({ id: ID, status: 'done', verdict: 'AC' })
    FakeEventSource.last!.emitNamed(`submission:${ID}`)

    await waitFor(() => expect(result.current.submission?.status).toBe('done'))
    expect(FakeEventSource.last!.closed).toBe(true)
  })

  it('đổi sang bài nộp khác thì xoá kết quả cũ ngay, không hiện nhầm của bài trước', async () => {
    const { result, rerender } = renderHook(({ id }) => useSubmissionStream(id), {
      initialProps: { id: ID },
    })
    get.mockResolvedValue({ id: ID, status: 'done', verdict: 'WA' })
    FakeEventSource.last!.emitNamed(`submission:${ID}`)
    await waitFor(() => expect(result.current.submission?.verdict).toBe('WA'))

    get.mockImplementation(() => new Promise(() => {})) // bài mới còn đang tải
    rerender({ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' })
    expect(result.current.submission).toBeNull()
  })
})
