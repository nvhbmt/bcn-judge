/**
 * Test cho `SplitPane` (FR-E1, FR-E2) và `HSplit` (FR-E5).
 *
 * jsdom không có layout engine: mọi `getBoundingClientRect()` trả 0 nên phép kẹp theo pixel
 * sẽ vô nghĩa nếu không gắn kích thước giả — `stubRect` bên dưới làm việc đó.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HSplit } from '@/components/layout/HSplit'
import { SplitPane } from '@/components/layout/SplitPane'

const KEY = 'bcn:test-split'

function stubRect(el: HTMLElement, box: { width?: number; height?: number; left?: number; top?: number }) {
  const width = box.width ?? 0
  const height = box.height ?? 0
  const left = box.left ?? 0
  const top = box.top ?? 0
  el.getBoundingClientRect = () => ({
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  })
}

/** Một nhịp kéo trọn vẹn: down → move → up, giống hệt chuột lẫn ngón tay (FR-E1). */
function drag(handle: HTMLElement, to: { clientX?: number; clientY?: number }, pointerType = 'mouse') {
  fireEvent.pointerDown(handle, { pointerId: 1, pointerType, clientX: 0, clientY: 0 })
  fireEvent.pointerMove(handle, { pointerId: 1, pointerType, ...to })
  fireEvent.pointerUp(handle, { pointerId: 1, pointerType, ...to })
}

function renderSplit(props: Partial<Parameters<typeof SplitPane>[0]> = {}, width = 1000) {
  const view = render(
    <SplitPane storageKey={KEY} left={<p>NỘI DUNG</p>} right={<p>CODE</p>} {...props} />,
  )
  stubRect(screen.getByTestId('split-pane'), { width, height: 600 })
  return view
}

describe('SplitPane — FR-E1 / FR-E2', () => {
  it('nhớ tỉ lệ qua localStorage và khôi phục khi mở lại', () => {
    window.localStorage.setItem(KEY, '0.62')
    renderSplit()

    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '62')
    expect(screen.getByTestId('split-pane')).toHaveAttribute('data-ratio', '0.6200')
  })

  it('kéo vạch chia đổi tỉ lệ và ghi lại vào localStorage', () => {
    renderSplit()
    drag(screen.getByRole('separator'), { clientX: 600 })

    // 600px con trỏ - 4px nửa vạch = 596/1000 khung.
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '60')
    expect(Number(window.localStorage.getItem(KEY))).toBeCloseTo(0.596, 3)
  })

  it('kẹp để không khung nào hẹp hơn 320px, dù kéo hết cỡ về hai phía', () => {
    renderSplit()
    const handle = screen.getByRole('separator')

    drag(handle, { clientX: 10 }) // kéo sát mép trái
    expect(handle).toHaveAttribute('aria-valuenow', '32') // 320/1000

    drag(handle, { clientX: 990 }) // kéo sát mép phải
    expect(handle).toHaveAttribute('aria-valuenow', '67') // (1000-320-8)/1000
  })

  it('kéo bằng cảm ứng đi đúng code path của chuột (pointer events)', () => {
    renderSplit()
    drag(screen.getByRole('separator'), { clientX: 400 }, 'touch')

    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '40')
  })

  it('nhấp đúp vạch chia đưa về tỉ lệ mặc định', () => {
    renderSplit({ defaultRatio: 0.4 })
    const handle = screen.getByRole('separator')

    drag(handle, { clientX: 800 })
    expect(handle).not.toHaveAttribute('aria-valuenow', '40')

    fireEvent.doubleClick(handle)
    expect(handle).toHaveAttribute('aria-valuenow', '40')
  })

  it('chỉnh được bằng phím mũi tên, Home và End (NFR-6)', () => {
    renderSplit()
    const handle = screen.getByRole('separator')
    handle.focus()
    expect(handle).toHaveFocus()

    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(handle).toHaveAttribute('aria-valuenow', '52')

    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(handle).toHaveAttribute('aria-valuenow', '48')

    fireEvent.keyDown(handle, { key: 'Home' })
    expect(handle).toHaveAttribute('aria-valuenow', '32')

    fireEvent.keyDown(handle, { key: 'End' })
    expect(handle).toHaveAttribute('aria-valuenow', '67')
  })

  it('thu gọn một khung vẫn giữ nội dung khung đó trong cây (FR-E2)', () => {
    renderSplit({ collapsed: 'left' })

    expect(screen.getByText('NỘI DUNG')).toBeInTheDocument()
    expect(screen.getByTestId('split-left')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('split-left')).toHaveAttribute('inert')
    // Vạch chia của khung đã thu gọn không được nhận focus lẫn phím mũi tên.
    expect(screen.getByRole('separator', { hidden: true })).toHaveAttribute('tabindex', '-1')
  })
})

describe('HSplit — FR-E5 (bảng điều khiển dưới editor)', () => {
  const HKEY = 'bcn:test-hsplit'

  function renderH(height = 800) {
    const view = render(<HSplit storageKey={HKEY} top={<p>EDITOR</p>} bottom={<p>CONSOLE</p>} />)
    stubRect(screen.getByTestId('hsplit'), { width: 900, height })
    return view
  }

  it('kéo vạch chia ngang đổi chiều cao và kẹp theo ngưỡng riêng của hai nửa', () => {
    renderH()
    const handle = screen.getByRole('separator')
    expect(handle).toHaveAttribute('aria-orientation', 'horizontal')

    drag(handle, { clientY: 400 })
    expect(handle).toHaveAttribute('aria-valuenow', '50')

    drag(handle, { clientY: 5 }) // sát mép trên: editor vẫn phải còn 160px
    expect(handle).toHaveAttribute('aria-valuenow', '20')

    drag(handle, { clientY: 795 }) // sát mép dưới: console vẫn phải còn 96px
    expect(handle).toHaveAttribute('aria-valuenow', '87')
  })

  it('phím lên/xuống chỉnh được và tỉ lệ được nhớ', () => {
    renderH()
    const handle = screen.getByRole('separator')

    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(handle).toHaveAttribute('aria-valuenow', '67')

    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(handle).toHaveAttribute('aria-valuenow', '63')
    expect(Number(window.localStorage.getItem(HKEY))).toBeCloseTo(0.63, 3)
  })
})
