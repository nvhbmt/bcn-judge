/** Test cho `IconRail` — FR-E7 (thanh icon 48px, chỉ icon + tooltip) và NFR-6. */
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IconRail, type RailItem } from '@/components/layout/IconRail'

const ITEMS: RailItem[] = [
  { key: 'mo-ta', label: 'Mô tả', icon: <svg data-testid="icon-mo-ta" /> },
  { key: 'giao-trinh', label: 'Giáo trình', icon: <svg /> },
  { key: 'bang-xep-hang', label: 'Bảng xếp hạng', icon: <svg /> },
  { key: 'tro-giup', label: 'Trợ giúp', icon: <svg />, badge: 3 },
]

function renderRail(activeKey: string | null = null) {
  const onSelect = vi.fn()
  render(<IconRail items={ITEMS} activeKey={activeKey} onSelect={onSelect} />)
  return { onSelect }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('IconRail — FR-E7', () => {
  it('render một nút cho mỗi mục, nằm trong một vùng điều hướng', () => {
    renderRail()

    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(ITEMS.length)
    // Chỉ icon: không nhãn nhìn thấy nào được render sẵn cạnh icon.
    expect(screen.queryByText('Mô tả')).not.toBeInTheDocument()
    expect(screen.getByTestId('icon-mo-ta')).toBeInTheDocument()
  })

  it('mỗi nút có aria-label và title để đọc màn hình lẫn tooltip hệ điều hành', () => {
    renderRail()
    const btn = screen.getByRole('button', { name: 'Giáo trình' })

    expect(btn).toHaveAttribute('title', 'Giáo trình')
  })

  it('tô sáng đúng mục đang mở bằng aria-current', () => {
    renderRail('giao-trinh')

    expect(screen.getByRole('button', { name: 'Giáo trình' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Mô tả' })).not.toHaveAttribute('aria-current')
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1)
  })

  it('activeKey = null là chế độ bài: không icon nào được tô sáng', () => {
    renderRail(null)

    // FR-E7 v0.5 — khung đầu đang hiện dải tab của bài, rail phải trung tính.
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(0)
    expect(screen.getAllByRole('button')).toHaveLength(ITEMS.length)
  })

  it('bấm icon gọi onSelect kèm key của mục', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderRail(null)

    await user.click(screen.getByRole('button', { name: 'Bảng xếp hạng' }))

    expect(onSelect).toHaveBeenCalledWith('bang-xep-hang')
  })

  it('tooltip hiện khi focus bằng Tab và tắt khi rời focus (NFR-6)', async () => {
    const user = userEvent.setup()
    renderRail(null)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Mô tả' })).toHaveFocus()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Mô tả')

    await user.tab()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Giáo trình')
  })

  it('tooltip hiện khi rê chuột và tắt khi rời chuột', async () => {
    const user = userEvent.setup()
    renderRail(null)
    const btn = screen.getByRole('button', { name: 'Trợ giúp (3)' })

    await user.hover(btn)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Trợ giúp')

    await user.unhover(btn)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('chạm vừa chuyển mục vừa hiện nhãn tạm rồi tự tắt', () => {
    vi.useFakeTimers()
    const { onSelect } = renderRail(null)
    const btn = screen.getByTestId('rail-item-mo-ta')

    fireEvent.pointerDown(btn, { pointerId: 1, pointerType: 'touch' })
    fireEvent.click(btn)

    expect(onSelect).toHaveBeenCalledWith('mo-ta') // vừa chuyển mục…
    expect(screen.getByRole('tooltip')).toHaveTextContent('Mô tả') // …vừa hiện nhãn

    act(() => {
      vi.advanceTimersByTime(2500)
    })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('badge đi vào nhãn trợ năng chứ không chỉ hiện bằng màu', () => {
    renderRail(null)

    expect(screen.getByRole('button', { name: 'Trợ giúp (3)' })).toBeInTheDocument()
    expect(screen.getByTestId('rail-badge-tro-giup')).toHaveAttribute('aria-hidden', 'true')
  })
})
