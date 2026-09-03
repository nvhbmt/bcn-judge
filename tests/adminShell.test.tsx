/**
 * Khung chung của cụm quản trị: nút hành động nằm cùng hàng tiêu đề, góc phải.
 *
 * Trước đây mỗi trang tự vẽ nút của mình ngay DƯỚI khối tiêu đề, nên nút rơi xuống
 * một hàng riêng và ba trang đặt nó ở ba độ cao khác nhau — mắt phải đi tìm lại ở mỗi
 * trang. Test này chốt hai điều: nút nằm TRONG <header> cùng với <h1>, và ô tìm / bộ
 * lọc thì KHÔNG (chúng thuộc về danh sách bên dưới).
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AdminShell } from '@/pages/admin/AdminShell'

const ve = (props: Parameters<typeof AdminShell>[0]) =>
  render(
    <MemoryRouter>
      <AdminShell {...props} />
    </MemoryRouter>,
  )

describe('AdminShell', () => {
  it('nút hành động nằm trong cùng <header> với tiêu đề', () => {
    ve({ title: 'Team', actions: <button>Tạo team</button>, children: <p>nội dung</p> })

    const header = screen.getByRole('heading', { level: 1 }).closest('header')!
    expect(within(header).getByRole('button', { name: 'Tạo team' })).toBeInTheDocument()
  })

  it('không truyền actions thì không dựng khung rỗng bên phải', () => {
    const { container } = ve({ title: 'Cài đặt', children: <p>nội dung</p> })
    const header = container.querySelector('header')!
    // Chỉ còn đúng một con: khối tiêu đề.
    expect(header.children).toHaveLength(1)
  })

  it('nội dung trang vẫn nằm NGOÀI header — nút hành động không nuốt phần thân', () => {
    ve({ title: 'Team', actions: <button>Tạo team</button>, children: <p>danh sách team</p> })

    const header = screen.getByRole('heading', { level: 1 }).closest('header')!
    expect(within(header).queryByText('danh sách team')).not.toBeInTheDocument()
    expect(screen.getByText('danh sách team')).toBeInTheDocument()
  })
})
