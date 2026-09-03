/**
 * Menu tài khoản ở góc phải thanh trên.
 *
 * Lý do có menu: ba việc của tài khoản trước đây nằm ba chỗ — theme và đăng xuất là hai
 * icon trần (đoán nghĩa bằng hình), còn ĐỔI MẬT KHẨU thì không có lối vào nào, dù server
 * vẫn nhận. Bộ test này canh cả ba, cộng với hai thứ menu nào cũng phải làm được nhưng
 * hay bị bỏ: đóng bằng Esc/bấm ra ngoài, và đi được bằng bàn phím.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserMenu } from '@/components/layout/UserMenu'
import { useAuth } from '@/stores/auth'
import type { Me } from '@/types/api'

const ME: Me = {
  id: 'u1',
  email: 'hoc.vien@bcn.local',
  displayName: 'Nguyễn Văn A',
  role: 'member',
  mustChangePassword: false,
  discordUsername: null,
  avatarUrl: null,
}

function dung() {
  useAuth.setState({ me: ME, loading: false })
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <UserMenu />
              <button type="button">nút khác ngoài menu</button>
            </>
          }
        />
        <Route path="/doi-mat-khau" element={<p>trang đổi mật khẩu</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const nut = () => screen.getByRole('button', { name: /Nguyễn Văn A/ })
const mo = async () => {
  await userEvent.click(nut())
  return screen.getByRole('menu')
}

beforeEach(() => {
  useAuth.setState({ me: null })
  document.documentElement.dataset.theme = 'light'
})

describe('UserMenu', () => {
  it('đóng sẵn, và nói cho trợ năng biết là đang đóng', () => {
    dung()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(nut()).toHaveAttribute('aria-expanded', 'false')
    expect(nut()).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('mở ra có đủ bốn việc của tài khoản', async () => {
    dung()
    await mo()
    expect(screen.getByRole('menuitem', { name: 'Tài khoản' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Nền tối' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Đổi mật khẩu' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Đăng xuất' })).toBeInTheDocument()
  })

  it('nói rõ đang là tài khoản nào — tên ở nút có thể bị cắt', async () => {
    dung()
    const menu = await mo()
    expect(menu).toHaveTextContent('hoc.vien@bcn.local')
  })

  it('mở ra là con trỏ bàn phím đã nằm trong menu, mũi tên đi được', async () => {
    dung()
    await mo()
    expect(document.activeElement).toHaveAccessibleName('Tài khoản')

    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toHaveAccessibleName('Nền tối')
    // Vòng lại từ cuối lên đầu, không kẹt ở mục cuối.
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(document.activeElement).toHaveAccessibleName('Tài khoản')
  })

  it('Esc đóng menu và trả tiêu điểm về nút — không bỏ rơi bàn phím giữa trang', async () => {
    dung()
    await mo()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(nut())
  })

  it('bấm ra ngoài thì đóng', async () => {
    dung()
    await mo()
    await userEvent.click(screen.getByRole('button', { name: 'nút khác ngoài menu' }))
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('đổi theme thì menu Ở NGUYÊN — để so hai bản không phải mở lại', async () => {
    dung()
    await mo()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Nền tối' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Nền sáng' })).toBeInTheDocument()
  })

  it('đổi mật khẩu đi tới trang đổi mật khẩu và đóng menu', async () => {
    dung()
    await mo()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Đổi mật khẩu' }))

    expect(await screen.findByText('trang đổi mật khẩu')).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('đăng xuất gọi đúng hành động đăng xuất', async () => {
    dung()
    const logout = vi.fn().mockResolvedValue(undefined)
    useAuth.setState({ logout })
    await mo()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Đăng xuất' }))

    expect(logout).toHaveBeenCalledOnce()
  })
})
