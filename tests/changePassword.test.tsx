/**
 * Trang đổi mật khẩu — MỘT trang, hai lối vào (FR-A2/A3 và menu tài khoản).
 *
 * Hai lối chỉ khác nhau ở lời dẫn và ở đường ra, mà đúng chỗ đó dễ sai:
 *   - bị BẮT đổi thì xong là vào thẳng app (người ta không định làm việc này, hệ thống
 *     chặn đường nên mới phải làm) — bắt bấm thêm nút xác nhận là thu phí oan;
 *   - TỰ vào thì phải có màn báo, không thì bấm xong màn hình y như cũ.
 *
 * Và `mustChangePassword` TẮT ngay khi đổi xong, nên nó phải được chốt lúc vào trang —
 * đọc sau khi đổi thì lối bắt buộc bỗng thành lối tự nguyện giữa chừng.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangePasswordPage } from '@/pages/ChangePasswordPage'
import { useAuth } from '@/stores/auth'
import type { Me } from '@/types/api'

const me = (mustChangePassword: boolean): Me => ({
  id: 'u1',
  email: 'a@bcn.local',
  displayName: 'Nguyễn Văn A',
  role: 'member',
  mustChangePassword,
  discordUsername: null,
})

function dung(batBuoc: boolean) {
  const changePassword = vi.fn().mockResolvedValue(true)
  useAuth.setState({ me: me(batBuoc), loading: false, error: null, changePassword })
  render(
    <MemoryRouter initialEntries={['/doi-mat-khau']}>
      <Routes>
        <Route path="/doi-mat-khau" element={<ChangePasswordPage />} />
        <Route path="/" element={<p>trang chủ</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return changePassword
}

async function dienVaGui() {
  await userEvent.type(screen.getByLabelText('Mật khẩu hiện tại'), 'matkhau123')
  await userEvent.type(screen.getByLabelText(/Mật khẩu mới/), 'matkhaumoi456')
  await userEvent.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'matkhaumoi456')
  await userEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))
}

beforeEach(() => useAuth.setState({ me: null, error: null }))

describe('lối BẮT BUỘC — mật khẩu do admin cấp', () => {
  it('nói rõ vì sao đang ở đây, và lối ra duy nhất là đăng xuất', () => {
    dung(true)
    expect(screen.getByText(/do quản trị viên cấp/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quay lại' })).not.toBeInTheDocument()
  })

  it('đổi xong vào thẳng app, không chặn thêm một nút xác nhận', async () => {
    dung(true)
    await dienVaGui()
    expect(await screen.findByText('trang chủ')).toBeInTheDocument()
  })
})

describe('lối TỰ NGUYỆN — từ menu tài khoản', () => {
  it('cảnh báo trước hệ quả thật: các thiết bị khác sẽ bị đăng xuất', () => {
    dung(false)
    expect(screen.getByText(/thiết bị khác/)).toBeInTheDocument()
    // Không bị chặn thì có đường lui, và không phải bằng cách đăng xuất.
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đăng xuất' })).not.toBeInTheDocument()
  })

  it('đổi xong có màn báo — không phải im lặng quay về như chưa có gì', async () => {
    dung(false)
    await dienVaGui()
    expect(await screen.findByText('Đã đổi mật khẩu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Về trang chủ' })).toBeInTheDocument()
  })
})

describe('chung cả hai lối', () => {
  it('hai ô mật khẩu mới lệch nhau thì không gửi đi', async () => {
    const changePassword = dung(false)
    await userEvent.type(screen.getByLabelText('Mật khẩu hiện tại'), 'matkhau123')
    await userEvent.type(screen.getByLabelText(/Mật khẩu mới/), 'matkhaumoi456')
    await userEvent.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'matkhaumoi999')

    expect(screen.getByRole('alert')).toHaveTextContent('chưa khớp')
    expect(screen.getByRole('button', { name: 'Đổi mật khẩu' })).toBeDisabled()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('server báo lỗi thì ở lại trang và nói ra, không nhận nhầm là xong', async () => {
    useAuth.setState({
      me: me(false),
      error: 'Mật khẩu hiện tại không đúng.',
      changePassword: vi.fn().mockResolvedValue(false),
    })
    render(
      <MemoryRouter>
        <ChangePasswordPage />
      </MemoryRouter>,
    )
    await dienVaGui()

    expect(screen.getByRole('alert')).toHaveTextContent('Mật khẩu hiện tại không đúng.')
    expect(screen.queryByText('Đã đổi mật khẩu')).not.toBeInTheDocument()
  })
})
