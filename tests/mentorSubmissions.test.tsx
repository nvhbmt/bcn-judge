/**
 * Mentor đọc bài nộp của học viên (FR-G3).
 *
 * Endpoint `GET /api/mentor/courses/:id/submissions` nằm sẵn ở server từ lâu, đủ bộ
 * lọc và trả kèm mã nguồn — SPA chưa từng gọi nó. Bộ test này canh phần vừa nối vào.
 *
 * Điểm dễ sai nhất và được canh riêng: đổi học viên mà panel phải vẫn hiện mã của
 * người trước. Lỗi đó không có thông báo nào cả — mentor đọc code của A rồi tưởng là
 * của B, và có thể nhận xét sai cho cả hai.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CourseSubmissionsPage } from '@/pages/mentor/CourseSubmissionsPage'

afterEach(() => vi.restoreAllMocks())

const HOC_VIEN = [
  { id: 'u1', displayName: 'Bùi Hữu Tuấn', status: 'active' },
  { id: 'u2', displayName: 'Bùi Thu Ngọc', status: 'active' },
]

const NOP = {
  u1: [
    { id: 's1', userId: 'u1', displayName: 'Bùi Hữu Tuấn', problemTitle: 'Đếm ước số', languageId: 'c11', verdict: 'AC', score: 100, receivedAt: '2026-08-20T10:15:00.000Z', source: 'int main(){ return 0; }' },
  ],
  u2: [
    { id: 's2', userId: 'u2', displayName: 'Bùi Thu Ngọc', problemTitle: 'Tổng hai số', languageId: 'c11', verdict: 'WA', score: 0, receivedAt: '2026-08-19T19:15:00.000Z', source: 'void khac(){}' },
  ],
}

function ve() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(typeof input === 'string' ? input : (input as Request).url)
    let data: unknown = []
    if (url.includes('/enrollments')) data = HOC_VIEN
    else if (url.includes('/submissions')) {
      const u = new URL(url, 'http://x').searchParams.get('userId') ?? ''
      data = NOP[u as keyof typeof NOP] ?? []
    } else if (url.includes('/languages')) {
      data = [{ id: 'c11', name: 'C', versionLabel: 'C11', cmMode: 'c' }]
    }
    return new Response(JSON.stringify({ success: true, data, meta: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/mentor/khoa-hoc/c1/bai-nop']}>
        <Routes>
          <Route path="/mentor/khoa-hoc/:courseId/bai-nop" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  render(<CourseSubmissionsPage />, { wrapper })
}

describe('mentor đọc bài nộp của học viên', () => {
  it('liệt kê học viên trong khoá', async () => {
    ve()
    expect(await screen.findByText('Bùi Hữu Tuấn')).toBeInTheDocument()
    expect(screen.getByText('Bùi Thu Ngọc')).toBeInTheDocument()
  })

  it('mở sẵn học viên đầu tiên và mã của lượt mới nhất', async () => {
    ve()
    // Tên bài có ở CẢ hai panel (dòng danh sách + tiêu đề chi tiết) — đúng như thiết kế.
    expect(await screen.findAllByText('Đếm ước số')).toHaveLength(2)
    await waitFor(() => expect(document.querySelector('.markdown-body')?.textContent).toContain('int main'))
  })

  it('đổi học viên thì panel phải đổi theo — KHÔNG giữ mã của người trước', async () => {
    ve()
    await screen.findAllByText('Đếm ước số')
    await userEvent.click(screen.getByRole('button', { name: /Bùi Thu Ngọc/ }))

    await waitFor(() => expect(screen.getAllByText('Tổng hai số').length).toBeGreaterThan(0))
    await waitFor(() => expect(document.querySelector('.markdown-body')?.textContent).toContain('void khac'))
    expect(document.querySelector('.markdown-body')?.textContent).not.toContain('int main')
  })

  it('mã nguồn được tô màu, không phải một khối chữ trơn', async () => {
    ve()
    await waitFor(() => expect(document.querySelectorAll('.markdown-body [class^="hljs-"]').length).toBeGreaterThan(0))
  })

  it('tên ngôn ngữ hiện dạng đọc được, không phải mã nội bộ', async () => {
    ve()
    expect(await screen.findByText('C')).toBeInTheDocument()
    expect(screen.queryByText('c11')).not.toBeInTheDocument()
  })
})
