/**
 * Panel Thảo luận: trạng thái KHOÁ (chưa AC) vs MỞ, và đăng chủ đề mới.
 *
 * Bất biến quan trọng nhất: khi canAccess=false, panel KHÔNG được lộ nội dung nào —
 * chỉ hiện lời nhắc "giải để mở".
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiscussionPanel } from '@/pages/workspace/discussion/DiscussionPanel'
import type { DiscussionData } from '@/pages/workspace/discussion/types'

afterEach(() => vi.restoreAllMocks())

const OPEN: DiscussionData = {
  canAccess: true,
  canPost: true,
  isStaff: false,
  threads: [
    {
      id: 't1',
      title: 'Vì sao WA test 3?',
      bodyMd: 'mình bị sai test 3',
      authorId: 'u2',
      authorName: 'Lan',
      createdAt: '2026-09-06T10:00:00Z',
      editedAt: null,
      pinned: false,
      isMine: false,
      canManage: false,
      canPin: false,
      replies: [
        {
          id: 'r1',
          bodyMd: 'dùng long long nhé',
          authorId: 'u3',
          authorName: 'Nam',
          createdAt: '2026-09-06T10:05:00Z',
          editedAt: null,
          isMine: false,
          canManage: false,
        },
      ],
    },
  ],
}

function mockGet(data: DiscussionData) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body = method === 'GET' ? { success: true, data } : { success: true, data: { id: 'new' } }
    return Promise.resolve(
      new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
    )
  })
}

function draw(props: { codeLang?: string; currentCode?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(<DiscussionPanel problemId="p1" {...props} />, { wrapper })
}

describe('DiscussionPanel', () => {
  it('CHƯA AC: hiện khoá, không lộ nội dung/ô soạn', async () => {
    mockGet({ canAccess: false, canPost: false, isStaff: false, threads: [] })
    draw()
    await waitFor(() => expect(screen.getByText(/Giải được bài để mở thảo luận/)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Đặt câu hỏi' })).toBeNull()
  })

  it('ĐÃ AC: hiện chủ đề + trả lời + nút đặt câu hỏi', async () => {
    mockGet(OPEN)
    draw()
    await waitFor(() => expect(screen.getByText('Vì sao WA test 3?')).toBeInTheDocument())
    expect(screen.getByText('Lan')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đặt câu hỏi' })).toBeInTheDocument()
  })

  it('"Chèn code đang viết" bọc mã editor bằng fence đúng ngôn ngữ', async () => {
    mockGet(OPEN)
    draw({ codeLang: 'c', currentCode: 'int main(){return 0;}' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Đặt câu hỏi' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Đặt câu hỏi' }))
    fireEvent.click(screen.getByRole('button', { name: /Chèn code đang viết/ }))
    const ta = screen.getByLabelText('Nội dung') as HTMLTextAreaElement
    expect(ta.value).toContain('```c')
    expect(ta.value).toContain('int main(){return 0;}')
    expect(ta.value.trimEnd().endsWith('```')).toBe(true)
  })

  it('không có code đang viết: ẩn nút "Chèn code đang viết", vẫn có "Khối code"', async () => {
    mockGet(OPEN)
    draw() // không truyền currentCode
    await waitFor(() => expect(screen.getByRole('button', { name: 'Đặt câu hỏi' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Đặt câu hỏi' }))
    expect(screen.getByRole('button', { name: /Khối code/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Chèn code đang viết/ })).toBeNull()
  })

  it('đăng chủ đề: mở ô soạn, điền, gửi POST đúng endpoint', async () => {
    mockGet(OPEN)
    draw()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Đặt câu hỏi' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Đặt câu hỏi' }))
    fireEvent.change(screen.getByLabelText('Tiêu đề chủ đề'), { target: { value: 'Câu hỏi mới' } })
    fireEvent.change(screen.getByLabelText('Nội dung'), { target: { value: 'nội dung câu hỏi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng chủ đề' }))

    await waitFor(() => {
      const calls = vi.mocked(globalThis.fetch).mock.calls as unknown[][]
      const post = calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST')
      expect(post).toBeTruthy()
      expect(String(post![0])).toContain('/api/member/discussion/problem/p1')
      expect(JSON.parse((post![1] as RequestInit).body as string)).toMatchObject({
        title: 'Câu hỏi mới',
        bodyMd: 'nội dung câu hỏi',
      })
    })
  })
})
