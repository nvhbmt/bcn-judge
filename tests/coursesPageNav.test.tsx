/**
 * Trang chủ là lối vào DUY NHẤT tới mọi cụm trang khác (không có header toàn cục),
 * nên một link thiếu ở đây đồng nghĩa cả một cụm không ai tới được.
 *
 * Đây chính là lỗi từng xảy ra thật: `App.tsx` khai đủ 5 route `/quan-tri/*` và
 * `pages/admin/` đã dựng xong mọi form, nhưng không chỗ nào link tới `/quan-tri`,
 * nên admin không có cách nào mở trang tạo team hay quản lí tài khoản ngoài việc
 * gõ tay URL. Test này canh từng lối vào theo vai trò.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CoursesPage } from '@/pages/CoursesPage'
import { useAuth } from '@/stores/auth'
import type { Me, Role } from '@/types/api'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(() => Promise.resolve([])) } }))

function renderAs(role: Role) {
  const me: Me = {
    id: 'u1',
    email: `${role}@bcn.local`,
    displayName: 'Người dùng thử',
    role,
    mustChangePassword: false,
  }
  useAuth.setState({ me, loading: false })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <CoursesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const linkTo = (name: string) => screen.queryByRole('link', { name: new RegExp(name) })

beforeEach(() => {
  useAuth.setState({ me: null })
})

describe('Trang chủ — lối vào các cụm trang', () => {
  it('admin thấy lối vào cụm quản trị, trỏ đúng /quan-tri', () => {
    renderAs('admin')

    const link = linkTo('Quản trị')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/quan-tri')
  })

  it('mentor và member KHÔNG thấy lối vào quản trị', () => {
    renderAs('mentor')
    expect(linkTo('Quản trị')).not.toBeInTheDocument()

    useAuth.setState({ me: null })
    renderAs('member')
    expect(linkTo('Quản trị')).not.toBeInTheDocument()
  })

  it('mentor thấy lối vào soạn bài và contest; member thì không', () => {
    renderAs('mentor')
    expect(linkTo('Soạn bài')).toHaveAttribute('href', '/mentor/bai-tap')
    expect(linkTo('Contest')).toHaveAttribute('href', '/mentor/contest')
  })

  it('member chỉ thấy lối vào Team', () => {
    renderAs('member')

    expect(linkTo('Team')).toHaveAttribute('href', '/team')
    expect(linkTo('Soạn bài')).not.toBeInTheDocument()
    expect(linkTo('Contest')).not.toBeInTheDocument()
  })

  it('admin thấy đủ mọi lối vào — admin ngầm có quyền của mentor', () => {
    renderAs('admin')

    for (const [name, href] of [
      ['Team', '/team'],
      ['Contest', '/mentor/contest'],
      ['Soạn bài', '/mentor/bai-tap'],
      ['Quản trị', '/quan-tri'],
    ] as const) {
      expect(linkTo(name)).toHaveAttribute('href', href)
    }
  })
})
