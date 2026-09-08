/**
 * Trang BXH: bục top-3, bảng phần còn lại, đổi phạm vi cá nhân↔team, và trạng thái rỗng.
 *
 * Bất biến dễ vỡ: top-3 lên BỤC (có cúp 🏆), hạng 4+ xuống BẢNG (không lặp lại top-3);
 * đổi tab Team phải gọi lại API với scope=team và hiện "N người".
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BXHPage } from '@/pages/leaderboard/BXHPage'

afterEach(() => vi.restoreAllMocks())

const INDIV = Array.from({ length: 5 }, (_, i) => ({
  rank: i + 1,
  userId: `u${i + 1}`,
  displayName: `Người ${i + 1}`,
  acCount: 10 - i,
  totalPoints: (10 - i) * 100,
  practicePoints: (10 - i) * 70,
  contestPoints: (10 - i) * 30,
  isMe: i === 4, // tôi đứng hạng 5 (ngoài bục)
}))

const TEAMS = [
  { rank: 1, id: 't1', name: 'Alpha', acCount: 20, totalPoints: 2000, memberCount: 4, isMine: true },
  { rank: 2, id: 't2', name: 'Beta', acCount: 18, totalPoints: 1900, memberCount: 3, isMine: false },
]

/** Mock fetch trả team hay cá nhân tuỳ query scope trong URL. */
function mockApi() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    const data = url.includes('scope=team') ? TEAMS : INDIV
    return Promise.resolve(
      new Response(JSON.stringify({ success: true, data, meta: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
  })
}

function draw() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(<BXHPage />, { wrapper })
}

describe('BXHPage', () => {
  it('top-3 lên bục (có cúp), hạng 4+ xuống bảng', async () => {
    mockApi()
    draw()
    // Bục: ba tên đầu + cúp cho hạng nhất.
    await waitFor(() => expect(screen.getByText('Người 1')).toBeInTheDocument())
    expect(screen.getByText('🏆')).toBeInTheDocument()
    // Bảng phần còn lại: hạng 5 là tôi, hiện "(bạn)"; hạng 1 KHÔNG lặp trong bảng.
    const table = screen.getByRole('table')
    expect(within(table).getByText(/Người 5 \(bạn\)/)).toBeInTheDocument()
    expect(within(table).queryByText('Người 1')).toBeNull()
  })

  it('đổi sang Team gọi lại API scope=team và hiện số người', async () => {
    mockApi()
    draw()
    await waitFor(() => expect(screen.getByText('Người 1')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('tab', { name: 'Team' }))
    // Alpha là team của tôi → hiện "Alpha (bạn)" trên bục.
    await waitFor(() => expect(screen.getByText(/Alpha \(bạn\)/)).toBeInTheDocument())
    expect(screen.getByText('4 người')).toBeInTheDocument()
    expect(
      (vi.mocked(globalThis.fetch).mock.calls as unknown[][]).some((c) => String(c[0]).includes('scope=team')),
    ).toBe(true)
  })

  it('mặc định là Tổng hợp: gọi API source=total, bảng tách cột Luyện · Contest · Tổng, bục ghi hai vế', async () => {
    mockApi()
    draw()
    await waitFor(() => expect(screen.getByText('Người 1')).toBeInTheDocument())
    expect(
      (vi.mocked(globalThis.fetch).mock.calls as unknown[][]).some((c) => String(c[0]).includes('source=total')),
    ).toBe(true)
    const table = screen.getByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Luyện' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Contest' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Tổng' })).toBeInTheDocument()
    // Hạng 5 (tôi): 6 × 70 = 420 luyện, 6 × 30 = 180 contest.
    expect(within(table).getByText('420')).toBeInTheDocument()
    expect(within(table).getByText('180')).toBeInTheDocument()
    // Bục hạng nhất: luyện 700 · contest 300.
    expect(screen.getByText('luyện 700 · contest 300')).toBeInTheDocument()
  })

  it('chọn Bài luyện thì gọi source=practice và bảng về một cột Điểm', async () => {
    mockApi()
    draw()
    await waitFor(() => expect(screen.getByText('Người 1')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('tab', { name: 'Bài luyện' }))
    await waitFor(() =>
      expect(
        (vi.mocked(globalThis.fetch).mock.calls as unknown[][]).some((c) => String(c[0]).includes('source=practice')),
      ).toBe(true),
    )
    // Đổi nguồn là một query MỚI: bảng biến mất một nhịp trong lúc tải rồi dựng lại.
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    const table = screen.getByRole('table')
    expect(within(table).queryByRole('columnheader', { name: 'Luyện' })).toBeNull()
    expect(within(table).getByRole('columnheader', { name: 'Điểm' })).toBeInTheDocument()
  })

  it('rỗng thì hiện trạng thái rỗng, không dựng bục/bảng', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [], meta: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    draw()
    await waitFor(() => expect(screen.getByText(/Chưa có kết quả trong kỳ này/)).toBeInTheDocument())
    expect(screen.queryByRole('table')).toBeNull()
  })
})
