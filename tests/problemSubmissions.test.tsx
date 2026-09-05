/**
 * Tab "Bài nộp" trong màn soạn bài của mentor (FR-G3).
 *
 * Sửa xong một bài thì câu hỏi kế tiếp là "học viên làm ra sao". Trước đó phải rời
 * màn soạn, mở khoá, tự dò từng người — mà bài của ngân hàng chung không thuộc khoá
 * nào nên có khi không đi vòng được.
 *
 * Điểm được canh kỹ nhất: đếm theo NGƯỜI, không theo lượt. "18 lượt AC" có thể là một
 * người nộp 18 lần, và đó là con số khiến mentor tưởng cả lớp đã qua.
 *
 * Đây là PANEL TRÁI của màn xem bài nộp: mỗi dòng bấm được, mã nguồn hiện ở panel
 * phải (ProblemSubmissionsPage).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProblemSubmissions } from '@/pages/mentor/problem/ProblemSubmissions'

afterEach(() => vi.restoreAllMocks())

const nop = (over: Record<string, unknown>) => ({
  id: 's1', userId: 'u1', displayName: 'Người A', languageId: 'c11',
  verdict: 'AC', score: 100, receivedAt: '2026-08-28T00:15:00.000Z', ...over,
})

function ve(rows: unknown[]) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ success: true, data: rows, meta: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const onSelect = vi.fn()
  render(<ProblemSubmissions problemId="p1" selectedId={null} onSelect={onSelect} />, { wrapper })
  return onSelect
}

describe('bài nộp của một bài', () => {
  it('đếm theo NGƯỜI, không theo lượt', async () => {
    // Một người nộp 3 lần, AC 2 lần → 1 người đã nộp, 1 người đạt AC, 3 lượt.
    ve([
      nop({ id: 's1' }),
      nop({ id: 's2' }),
      nop({ id: 's3', verdict: 'WA', score: 0 }),
    ])
    expect(await screen.findByText(/1 người đã nộp/)).toBeInTheDocument()
    expect(screen.getByText(/1 người đạt AC/)).toBeInTheDocument()
    expect(screen.getByText(/3 lượt/)).toBeInTheDocument()
  })

  it('người chỉ nộp sai KHÔNG bị tính vào số đạt AC', async () => {
    ve([nop({ id: 's1' }), nop({ id: 's2', userId: 'u2', displayName: 'Người B', verdict: 'WA', score: 0 })])
    expect(await screen.findByText(/2 người đã nộp/)).toBeInTheDocument()
    expect(screen.getByText(/1 người đạt AC/)).toBeInTheDocument()
  })

  it('liệt kê từng lượt kèm tên và verdict', async () => {
    ve([nop({})])
    expect(await screen.findByText('Người A')).toBeInTheDocument()
    expect(screen.getByText('Chấp nhận')).toBeInTheDocument()
  })

  it('bấm một dòng thì báo lên cho panel phải biết', async () => {
    const onSelect = ve([nop({ id: 'abc' })])
    await userEvent.click(await screen.findByRole('button', { name: /Người A/ }))
    expect(onSelect).toHaveBeenCalledWith('abc')
  })

  it('chưa ai nộp thì nói rõ, không dựng bảng rỗng', async () => {
    ve([])
    expect(await screen.findByText('Chưa ai nộp bài này')).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})
