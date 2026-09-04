/**
 * Danh sách bài trong contest: cột cuối nói ĐÃ ĐỤNG BÀI NÀY CHƯA.
 *
 * Đỏ = chưa nộp, xanh = đã nộp. Giữa contest, câu hỏi đầu tiên là "còn bài nào mình
 * chưa đụng tới", mà một cột xám đều thì phải đọc từng chữ mới trả lời được.
 *
 * Cột này KHÔNG nói bài đã đúng hay chưa — cột điểm bên trái nói việc đó. Test dưới
 * đây chốt đúng ranh giới ấy: bài đã nộp mà 0 điểm vẫn XANH ở cột trạng thái và vẫn
 * earth ở cột điểm; gộp hai câu vào một màu là chỗ dễ sai nhất.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContestProblems } from '@/pages/contest/ContestProblems'

afterEach(() => vi.restoreAllMocks())

const BAI = [
  { id: 'p1', label: '1', title: 'Đã nộp và AC', maxScore: 100 },
  { id: 'p2', label: '2', title: 'Đã nộp mà chưa trọn điểm', maxScore: 100 },
  { id: 'p3', label: '3', title: 'Chưa đụng tới', maxScore: 100 },
]

function ve() {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        success: true,
        data: [
          {
            rank: 1, userId: 'u1', displayName: 'Tôi', totalPoints: 140, acCount: 1, lastGain: null, isMe: true,
            problems: {
              p1: { points: 100, verdict: 'AC', attempts: 2 },
              p2: { points: 40, verdict: 'WA', attempts: 5 },
            },
          },
        ],
        meta: {},
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  render(<ContestProblems contestId="c1" problems={BAI} />, { wrapper })
}

const mau = (el: HTMLElement) => el.className

describe('trạng thái nộp của từng bài', () => {
  it('chưa nộp thì ĐỎ', async () => {
    ve()
    await waitFor(() => expect(screen.getByText('chưa nộp')).toBeInTheDocument())
    expect(mau(screen.getByText('chưa nộp'))).toContain('--color-wa')
  })

  it('đã nộp thì XANH', async () => {
    ve()
    expect(mau(await screen.findByText('2 lần'))).toContain('text-moss')
  })

  it('đã nộp mà CHƯA trọn điểm vẫn xanh ở cột trạng thái', async () => {
    // Hai cột trả lời hai câu khác nhau: "đã đụng chưa" và "ăn được bao nhiêu điểm".
    // Gộp thành một màu là mất một câu.
    ve()
    expect(mau(await screen.findByText('5 lần'))).toContain('text-moss')
  })

  it('và cột ĐIỂM vẫn phân biệt AC với chưa trọn điểm', async () => {
    ve()
    await screen.findByText('5 lần')
    expect(mau(screen.getByText('100'))).toContain('text-moss')
    expect(mau(screen.getByText('40'))).toContain('text-earth')
  })
})
