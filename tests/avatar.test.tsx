/**
 * Ảnh đại diện lấy từ Discord.
 *
 * Hai nhánh lùi đều phải chạy, vì phần lớn tài khoản sẽ rơi vào chúng:
 *   - chưa gắn Discord, hoặc gắn rồi mà để ảnh mặc định (Discord trả `avatar: null`)
 *     → chữ cái đầu tên, không phải khung rỗng;
 *   - hash đã cũ (đổi ảnh giữa hai lần đăng nhập) nên URL 404 → cũng lùi về chữ, chứ
 *     không để lại cái khung ảnh vỡ nằm đó vĩnh viễn.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar, initials } from '@/components/ui/patterns'

const anh = () => document.querySelector('img')

describe('Avatar', () => {
  it('không có ảnh thì hiện chữ cái đầu tên', () => {
    render(<Avatar name="Trần Quốc Bảo" />)
    expect(screen.getByText(initials('Trần Quốc Bảo'))).toBeInTheDocument()
    expect(anh()).toBeNull()
  })

  it('có ảnh thì hiện ảnh, không hiện chữ', () => {
    render(<Avatar name="Trần Quốc Bảo" src="https://cdn.discordapp.com/avatars/1/abc.png?size=64" />)
    expect(anh()).toHaveAttribute('src', 'https://cdn.discordapp.com/avatars/1/abc.png?size=64')
    expect(screen.queryByText(initials('Trần Quốc Bảo'))).not.toBeInTheDocument()
  })

  it('ảnh tải hỏng thì lùi về chữ, không để khung vỡ', () => {
    render(<Avatar name="Trần Quốc Bảo" src="https://cdn.discordapp.com/avatars/1/hash-cu.png" />)
    fireEvent.error(anh()!)
    expect(screen.getByText(initials('Trần Quốc Bảo'))).toBeInTheDocument()
    expect(anh()).toBeNull()
  })

  it('ảnh là trang trí: alt rỗng và cả khối aria-hidden — tên đã có ở chữ cạnh bên', () => {
    const { container } = render(<Avatar name="Trần Quốc Bảo" src="https://x/a.png" />)
    expect(anh()).toHaveAttribute('alt', '')
    expect(container.firstElementChild).toHaveAttribute('aria-hidden')
  })
})
