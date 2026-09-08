/**
 * Điều hướng toàn cục — canh đúng lớp lỗi "cụm không ai tới được".
 *
 * Trước bản v2, `CoursesPage` kiêm vai trò thanh điều hướng, và mọi cụm nó quên link
 * tới thì không mở được: `/quan-tri` từng như vậy (sửa ở 6bd5cdb), `/contest` của
 * member cũng vậy. Bản v2 gom điều hướng vào `TopBar`, nên test này chuyển theo —
 * ý nghĩa giữ nguyên: mỗi vai trò thấy đúng những lối vào mình có quyền.
 *
 * Mỗi mục ở đây phải trỏ tới một route CÓ THẬT trong App.tsx. Thêm mục mà quên khai
 * route là tạo link chết — đúng thứ bộ test này tồn tại để chặn.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { TopBar } from '@/components/layout/TopBar'
import { useAuth } from '@/stores/auth'
import type { Me, Role } from '@/types/api'


function renderAs(role: Role) {
  const me: Me = {
    id: 'u1',
    email: `${role}@bcn.local`,
    displayName: 'Người dùng thử',
    role,
    mustChangePassword: false,
    discordUsername: null,
  avatarUrl: null,
    shareSolutions: true,
  }
  useAuth.setState({ me, loading: false })
  render(
    <MemoryRouter>
      <TopBar />
    </MemoryRouter>,
  )
}

const linkTo = (name: string) => screen.queryByRole('link', { name: new RegExp(name) })

beforeEach(() => {
  useAuth.setState({ me: null })
  document.documentElement.dataset.theme = 'light'
})

describe('TopBar — lối vào theo vai trò', () => {
  it('member thấy đúng ba lối vào của mình', () => {
    renderAs('member')

    expect(linkTo('khoá-học')).toHaveAttribute('href', '/')
    expect(linkTo('~/contest')).toHaveAttribute('href', '/contest')
    expect(linkTo('team')).toHaveAttribute('href', '/team')
  })

  it('member KHÔNG thấy lối vào của mentor hay quản trị', () => {
    renderAs('member')

    expect(linkTo('bài-tập')).not.toBeInTheDocument()
    expect(linkTo('soạn-contest')).not.toBeInTheDocument()
    expect(linkTo('quản-trị')).not.toBeInTheDocument()
  })

  it('mentor thấy thêm soạn bài và soạn contest, nhưng không thấy quản trị', () => {
    renderAs('mentor')

    expect(linkTo('bài-tập')).toHaveAttribute('href', '/mentor/bai-tap')
    expect(linkTo('soạn-contest')).toHaveAttribute('href', '/mentor/contest')
    expect(linkTo('quản-trị')).not.toBeInTheDocument()
  })

  it('admin thấy đủ mọi lối vào — admin ngầm có quyền của mentor', () => {
    renderAs('admin')

    for (const [name, href] of [
      ['khoá-học', '/'],
      ['~/contest', '/contest'],
      ['team', '/team'],
      ['bài-tập', '/mentor/bai-tap'],
      ['soạn-contest', '/mentor/contest'],
      ['quản-trị', '/quan-tri'],
    ] as const) {
      expect(linkTo(name)).toHaveAttribute('href', href)
    }
  })

  it('chưa đăng nhập thì không vẽ gì', () => {
    useAuth.setState({ me: null })
    const { container } = render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>,
    )

    expect(container).toBeEmptyDOMElement()
  })
})

describe('TopBar — đổi theme', () => {
  // Nút đổi theme nay nằm TRONG menu tài khoản (UserMenu). Test vẫn đi đúng đường
  // người dùng đi: mở menu rồi bấm, chứ không gọi thẳng toggleTheme().
  const moMenu = async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    await userEvent.click(screen.getByRole('button', { name: /Người dùng thử/ }))
    return userEvent
  }

  it('mục đổi theme nói rõ nó sẽ chuyển sang bên nào', async () => {
    renderAs('member')
    await moMenu()

    expect(screen.getByRole('menuitem', { name: 'Nền tối' })).toBeInTheDocument()
  })

  it('bấm một lần thì đổi sang tối và ghi lên thẻ html', async () => {
    renderAs('member')
    const userEvent = await moMenu()

    await userEvent.click(screen.getByRole('menuitem', { name: 'Nền tối' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    // Menu KHÔNG đóng: đổi theme là thứ người ta bật lên xem thử rồi đổi lại ngay.
    expect(screen.getByRole('menuitem', { name: 'Nền sáng' })).toBeInTheDocument()
  })
})
