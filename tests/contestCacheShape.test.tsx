/**
 * Chốt sự cố: `['contest', id]` từng bị ba nơi ghi bằng HAI hình dạng khác nhau.
 *
 * `ContestPage` gọi `api.getWithMeta` nên ghi cả phong bì `{data, meta}`; `siblings.ts`
 * và `ContestProblemList` gọi `api.get` nên ghi phần đã bóc. React Query chỉ giữ một ô
 * cache cho mỗi key, nên bên đọc sau nhận hình dạng của bên ghi trước: `contest` vẫn
 * "truthy" mà `contest.problems` là `undefined` → `list.findIndex` ném TypeError và
 * giết cả màn làm bài.
 *
 * Lỗi phụ thuộc THỨ TỰ điều hướng (vào thẳng bằng URL nguội thì không sao), nên nó
 * sống sót qua mọi test cũ. Test này dựng đúng thứ tự gây lỗi: nạp cache theo kiểu
 * trang contest đã chạy trước, rồi mới đọc bằng `useSiblings`.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useSiblings } from '@/pages/workspace/siblings'

const CONTEST_ID = 'ct-1'
const DETAIL = {
  id: CONTEST_ID,
  title: 'Code C hằng tuần — Tuần 1',
  descriptionMd: null,
  startAt: '2026-09-02T01:48:59.000Z',
  endAt: '2026-09-05T16:59:59.000Z',
  phase: 'dang-dien-ra' as const,
  freezeMinutes: 0,
  problemCount: 3,
  problems: [
    { id: 'cp-1', label: '1', position: 1, title: 'Bài 1', maxScore: 100 },
    { id: 'cp-2', label: '2', position: 2, title: 'Bài 2', maxScore: 100 },
    { id: 'cp-3', label: '3', position: 3, title: 'Bài 3', maxScore: 100 },
  ],
}

function wrapperWithSeededCache(seed: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // Đúng thứ tự gây lỗi: trang contest đã chạy và ghi cache TRƯỚC khi màn làm bài đọc.
  client.setQueryData(['contest', CONTEST_ID], seed)
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useSiblings trên đường contest', () => {
  it('không nổ khi cache đã được trang contest ghi dưới dạng phong bì {data, meta}', async () => {
    const wrapper = wrapperWithSeededCache({ data: DETAIL, meta: { serverTime: '2026-09-02T02:00:00.000Z' } })

    const { result } = renderHook(
      () => useSiblings({ contestId: CONTEST_ID, contestProblemId: 'cp-2' }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.resolved).toBe(true))
    expect(result.current.position).toBe('bài 2/3')
    expect(result.current.prev).toEqual({ href: `/contest/${CONTEST_ID}/bai/cp-1`, title: 'Bài 1' })
    expect(result.current.next).toEqual({ href: `/contest/${CONTEST_ID}/bai/cp-3`, title: 'Bài 3' })
  })

  it('vẫn dựng được điều hướng khi vào thẳng bằng URL nguội (cache rỗng)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: DETAIL, meta: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () => useSiblings({ contestId: CONTEST_ID, contestProblemId: 'cp-1' }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.position).toBe('bài 1/3'))
    expect(result.current.prev).toBeNull()
    expect(result.current.next).toEqual({ href: `/contest/${CONTEST_ID}/bai/cp-2`, title: 'Bài 2' })
    vi.restoreAllMocks()
  })
})
