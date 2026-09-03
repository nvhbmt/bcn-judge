/**
 * Con mắt bật/tắt hiện mật khẩu.
 *
 * Hai thứ được canh, cả hai đều là lỗi câm nếu sai:
 *   - `type="button"`. Nút không khai type nằm trong <form> mặc định là SUBMIT, nên
 *     bấm để xem mật khẩu sẽ gửi luôn form — ở màn đăng nhập là gửi một lần đăng
 *     nhập với mật khẩu gõ dở, ăn một nhịp của giới hạn 10 lần/phút mỗi IP.
 *   - trạng thái nói bằng `aria-pressed`, không bằng icon: trình đọc màn hình không
 *     thấy icon, và nhãn thì luôn là HÀNH ĐỘNG sắp làm chứ không phải trạng thái.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type FormEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PasswordEye } from '@/components/ui'

function Thu({ onSubmit }: { onSubmit?: (e: FormEvent) => void }) {
  const [hien, setHien] = useState(false)
  return (
    <form onSubmit={onSubmit}>
      <input aria-label="Mật khẩu" type={hien ? 'text' : 'password'} defaultValue="bi-mat" />
      <PasswordEye shown={hien} onToggle={() => setHien((v) => !v)} />
    </form>
  )
}

describe('PasswordEye', () => {
  it('đang giấu thì mời "Hiện", bấm xong đổi thành "Ẩn"', async () => {
    render(<Thu />)
    const nut = screen.getByRole('button', { name: 'Hiện mật khẩu' })
    expect(nut).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(nut)
    const sau = screen.getByRole('button', { name: 'Ẩn mật khẩu' })
    expect(sau).toHaveAttribute('aria-pressed', 'true')
  })

  it('đổi thật type của ô nhập', async () => {
    render(<Thu />)
    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }))
    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('type', 'text')
  })

  it('KHÔNG gửi form khi bấm — nút trong form mặc định là submit', async () => {
    const submit = vi.fn((e: FormEvent) => e.preventDefault())
    render(<Thu onSubmit={submit} />)
    await userEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }))
    expect(submit).not.toHaveBeenCalled()
  })
})
