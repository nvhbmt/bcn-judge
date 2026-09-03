/**
 * Đăng nhập bằng Discord — phần giao diện.
 *
 * Hai điều được canh, cả hai đều là "hỏng lặng lẽ" nếu sai:
 *   - hệ CHƯA cấu hình Discord thì KHÔNG vẽ nút. Vẽ ra rồi để người ta bấm nghĩa là
 *     họ bị đá về đúng màn cũ, không thông báo, và tưởng mình gõ sai gì đó. Đây đúng
 *     lớp lỗi mà repo anh em đã dính với `AI_KEY_ENC_KEY`;
 *   - callback hỏng thì lý do phải hiện thành CHỮ. Server chỉ trả mã trong URL, nên
 *     thiếu bảng dịch là người dùng chỉ thấy mình quay về chỗ cũ.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountPage } from '@/pages/AccountPage'
import { LoginPage } from '@/pages/LoginPage'
import { useAuth } from '@/stores/auth'
import type { Me } from '@/types/api'

const ME: Me = {
  id: 'u1',
  email: 'a@bcn.local',
  displayName: 'Nguyễn Văn A',
  role: 'member',
  mustChangePassword: false,
  discordUsername: null,
}

function traLoi(map: Record<string, unknown>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(typeof input === 'string' ? input : (input as Request).url)
    for (const [phan, data] of Object.entries(map)) {
      if (url.includes(phan)) {
        return new Response(JSON.stringify({ success: true, data, meta: {} }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
    }
    return new Response(JSON.stringify({ success: false, error: { code: 'x', message: 'không có' } }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  })
}

function ve(node: ReactNode, url = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="*" element={node} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => useAuth.setState({ me: null, loading: false, error: null }))
afterEach(() => vi.restoreAllMocks())

describe('màn đăng nhập', () => {
  it('server nói CHƯA bật thì không vẽ nút Discord', async () => {
    traLoi({ '/auth/providers': { discord: false } })
    ve(<LoginPage />)

    await waitFor(() => expect(screen.getByRole('button', { name: /Đăng nhập/ })).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: /Discord/ })).not.toBeInTheDocument()
  })

  it('bật thì vẽ nút, và nút đi thẳng ra /auth/discord chứ không qua router', async () => {
    traLoi({ '/auth/providers': { discord: true } })
    ve(<LoginPage />)

    const nut = await screen.findByRole('link', { name: /Đăng nhập bằng Discord/ })
    // Điều hướng RỜI KHỎI SPA: phải là href thật, <Link> chỉ đổi URL trong bộ nhớ.
    expect(nut).toHaveAttribute('href', '/auth/discord')
  })

  it('callback hỏng thì dịch mã trong URL thành câu tiếng Việt', async () => {
    traLoi({ '/auth/providers': { discord: true } })
    ve(<LoginPage />, '/dang-nhap?discord=chua_gan')

    expect(await screen.findByRole('alert')).toHaveTextContent(/chưa gắn với tài khoản nào/i)
  })

  it('mã lạ thì không dựng khung báo lỗi rỗng', async () => {
    traLoi({ '/auth/providers': { discord: true } })
    ve(<LoginPage />, '/dang-nhap?discord=khong-co-ma-nay')

    await screen.findByRole('link', { name: /Discord/ })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('trang tài khoản', () => {
  it('chưa gắn thì mời gắn', () => {
    useAuth.setState({ me: ME })
    traLoi({})
    ve(<AccountPage />)

    expect(screen.getByText(/Chưa gắn tài khoản Discord nào/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gắn Discord' })).toHaveAttribute(
      'href',
      '/auth/discord?intent=link',
    )
  })

  it('đã gắn thì hiện tên Discord và cho bỏ gắn', () => {
    useAuth.setState({ me: { ...ME, discordUsername: 'coder_a' } })
    traLoi({})
    ve(<AccountPage />)

    expect(screen.getByText('coder_a')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bỏ gắn' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Gắn Discord' })).not.toBeInTheDocument()
  })

  it('kết quả gắn hiện thành lời ngay trên trang', () => {
    useAuth.setState({ me: { ...ME, discordUsername: 'coder_a' } })
    traLoi({})
    ve(<AccountPage />, '/tai-khoan?discord=da_gan')

    expect(screen.getByRole('status')).toHaveTextContent(/Đã gắn Discord/)
  })

  it('server chặn bỏ gắn thì nói lý do của server, không nói câu chung', async () => {
    useAuth.setState({ me: { ...ME, discordUsername: 'coder_a' } })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, error: { code: 'bad', message: 'Tài khoản này chưa có mật khẩu.' } }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
    )
    ve(<AccountPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Bỏ gắn' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Tài khoản này chưa có mật khẩu.')
  })
})
