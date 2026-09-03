/**
 * Ghi danh member: CHỌN từ danh sách là cách chính, dán email là cách phụ.
 *
 * Trước đây chỉ có ô dán email. Thêm một hai người là việc hằng tuần, mà bắt gõ đúng
 * nguyên địa chỉ cho một cú thêm là quá đắt — gõ sai một ký tự thì không có gì xảy ra
 * và cũng không rõ vì sao.
 *
 * Ô dán KHÔNG bị xoá, chỉ thu vào sau một nút: đó là US-1 (dán 40 dòng từ Excel hay
 * Zalo lúc mở khoá mới), bỏ đi là bắt người ta thêm 40 lượt.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CourseEnrollments } from '@/pages/admin/CourseEnrollments'

afterEach(() => vi.restoreAllMocks())

const DA_GHI_DANH = [{ id: 'u1', email: 'a@bcn.local', displayName: 'Đã Có Rồi', status: 'active' }]
const TIM_THAY = [
  { id: 'u1', email: 'a@bcn.local', displayName: 'Đã Có Rồi' },
  { id: 'u2', email: 'b@bcn.local', displayName: 'Người Mới' },
]

function ve(scope: 'admin' | 'mentor' = 'mentor') {
  const goi: { url: string; method?: string; body?: unknown }[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(typeof input === 'string' ? input : (input as Request).url)
    goi.push({ url, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const data = url.includes('/members') || url.includes('/users?') ? TIM_THAY : DA_GHI_DANH
    return new Response(JSON.stringify({ success: true, data, meta: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(<CourseEnrollments courseId="c1" scope={scope} />, { wrapper })
  return goi
}

describe('ghi danh bằng cách chọn từ danh sách', () => {
  it('ô tìm hiện sẵn, ô dán email thu lại sau một nút', async () => {
    ve()
    expect(await screen.findByLabelText('Tìm tài khoản')).toBeInTheDocument()
    expect(screen.queryByLabelText('Dán danh sách email')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /dán cả danh sách email/i }))
    expect(screen.getByLabelText('Dán danh sách email')).toBeInTheDocument()
  })

  it('mentor tìm qua đường của mentor, không phải đường admin (đường kia là 403)', async () => {
    const goi = ve('mentor')
    await userEvent.type(await screen.findByLabelText('Tìm tài khoản'), 'ng')
    await waitFor(() => expect(goi.some((g) => g.url.includes('/api/mentor/members?q=ng'))).toBe(true))
    expect(goi.some((g) => g.url.includes('/api/admin/users'))).toBe(false)
  })

  it('admin vẫn đi đường admin', async () => {
    const goi = ve('admin')
    await userEvent.type(await screen.findByLabelText('Tìm tài khoản'), 'ng')
    await waitFor(() => expect(goi.some((g) => g.url.includes('/api/admin/users?q=ng'))).toBe(true))
  })

  it('người ĐÃ ghi danh hiện "Đã có" và không bấm được', async () => {
    ve()
    await userEvent.type(await screen.findByLabelText('Tìm tài khoản'), 'ng')
    const daCo = await screen.findByRole('button', { name: 'Đã có' })
    expect(daCo).toBeDisabled()
  })

  it('bấm Ghi danh gửi email của đúng người vừa chọn', async () => {
    const goi = ve()
    await userEvent.type(await screen.findByLabelText('Tìm tài khoản'), 'ng')
    await userEvent.click(await screen.findByRole('button', { name: 'Ghi danh' }))

    await waitFor(() => {
      const post = goi.find((g) => g.method === 'POST')
      expect(post?.body).toEqual({ emails: ['b@bcn.local'] })
    })
  })
})
