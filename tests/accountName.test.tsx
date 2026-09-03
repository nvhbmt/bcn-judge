/**
 * Tự đổi tên hiển thị ở trang Tài khoản.
 *
 * Điều được canh kỹ nhất là nút Lưu TẮT khi chưa đổi gì thật. Bấm Lưu mà tên y
 * nguyên là một lượt ghi DB, một dòng nhật ký kiểm toán và một cú nhấp nháy trạng
 * thái, đổi lấy đúng con số không — mà khoảng trắng thừa ở cuối tên là thứ người ta
 * gõ vào rất dễ.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountPage } from '@/pages/AccountPage'
import { useAuth } from '@/stores/auth'
import type { Me } from '@/types/api'

const ME: Me = {
  id: 'u1',
  email: 'a@bcn.local',
  displayName: 'Nguyễn Văn A',
  role: 'member',
  mustChangePassword: false,
  discordUsername: null,
  avatarUrl: null,
}

function ve(fetchImpl?: typeof globalThis.fetch) {
  useAuth.setState({ me: ME, loading: false, error: null })
  // Bản giả có TRẠNG THÁI, như server thật: PATCH đổi tên, GET /auth/me trả tên hiện
  // hành. Trả `data: {}` cho mọi request thì sau lượt lưu, `me` thành object rỗng và
  // trang vẽ với mọi trường undefined — test xanh/đỏ vì lý do không liên quan.
  let ten = ME.displayName
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    fetchImpl ??
      (async (_input, init) => {
        if (init?.method === 'PATCH') ten = (JSON.parse(String(init.body)) as { displayName: string }).displayName
        return new Response(JSON.stringify({ success: true, data: { ...ME, displayName: ten }, meta: {} }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  render(<AccountPage />, { wrapper })
}

const o = () => screen.getByLabelText('Tên hiển thị')
const nutLuu = () => screen.getByRole('button', { name: /Lưu/ })

beforeEach(() => useAuth.setState({ me: null }))
afterEach(() => vi.restoreAllMocks())

describe('đổi tên hiển thị', () => {
  it('ô nhập mở sẵn với tên đang dùng, nút Lưu tắt', () => {
    ve()
    expect(o()).toHaveValue('Nguyễn Văn A')
    expect(nutLuu()).toBeDisabled()
  })

  it('chỉ thêm khoảng trắng thì vẫn coi là chưa đổi gì', async () => {
    ve()
    await userEvent.type(o(), '   ')
    expect(nutLuu()).toBeDisabled()
  })

  it('xoá trắng tên thì không lưu được — người đó sẽ biến mất khỏi mọi bảng', async () => {
    ve()
    await userEvent.clear(o())
    expect(nutLuu()).toBeDisabled()
  })

  it('đổi thật thì gửi PATCH /auth/me với tên đã cắt khoảng trắng', async () => {
    const goi: { url: string; body: unknown; method?: string }[] = []
    ve(async (input, init) => {
      goi.push({ url: String(input), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : null })
      return new Response(JSON.stringify({ success: true, data: {}, meta: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    await userEvent.clear(o())
    await userEvent.type(o(), '  Nguyễn Văn B  ')
    await userEvent.click(nutLuu())

    const patch = goi.find((g) => g.method === 'PATCH')
    expect(patch?.url).toContain('/auth/me')
    expect(patch?.body).toEqual({ displayName: 'Nguyễn Văn B' })
  })

  it('lưu xong thì ô hiện đúng chuỗi ĐÃ LƯU, không còn khoảng trắng thừa', async () => {
    ve()
    await userEvent.clear(o())
    await userEvent.type(o(), '  Nguyễn Văn B  ')
    await userEvent.click(nutLuu())

    expect(await screen.findByText('Đã lưu')).toBeInTheDocument()
    expect(o()).toHaveValue('Nguyễn Văn B')
  })

  it('server từ chối thì nói lý do của server', async () => {
    ve(async () =>
      new Response(
        JSON.stringify({ success: false, error: { code: 'bad', message: 'Tên hiển thị không được để trống.' } }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
    )
    await userEvent.type(o(), 'B')
    await userEvent.click(nutLuu())

    expect(await screen.findByRole('alert')).toHaveTextContent('Tên hiển thị không được để trống.')
  })

  it('email và vai trò chỉ để đọc, không có ô nhập nào cho chúng', () => {
    ve()
    // Email là khoá định danh (Discord khớp vào đó), vai trò do admin cấp — cho sửa
    // ở đây là đưa cổng quyền vào tay chính người bị quản.
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Vai trò')).not.toBeInTheDocument()
    expect(screen.getByText('a@bcn.local')).toBeInTheDocument()
  })
})
