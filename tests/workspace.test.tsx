/** Test cho `Workspace` — FR-E1 (ba vùng) và FR-E9 (dưới 900px đổi sang hai tab). */
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NARROW_QUERY, Workspace } from '@/components/layout/Workspace'

/**
 * jsdom không có `matchMedia`; giả lập một MediaQueryList tối thiểu và trả về hàm `emit`
 * để mô phỏng người dùng xoay ngang máy / đổi cỡ cửa sổ.
 */
function stubViewport(narrow: boolean) {
  const listeners = new Set<() => void>()
  const mql = {
    matches: narrow,
    media: NARROW_QUERY,
    onchange: null,
    addEventListener: (_type: string, cb: () => void) => void listeners.add(cb),
    removeEventListener: (_type: string, cb: () => void) => void listeners.delete(cb),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql),
  )
  return {
    emit(next: boolean) {
      mql.matches = next
      act(() => {
        listeners.forEach((cb) => cb())
      })
    },
  }
}

function renderWorkspace(contentLabel = 'Đề bài', onRail = vi.fn()) {
  const view = render(
    <Workspace
      storageKey="bcn:test-workspace"
      contentLabel={contentLabel}
      rail={
        <nav aria-label="rail">
          <button type="button" aria-label="Trợ giúp" onClick={() => onRail()} />
        </nav>
      }
      content={<p>ĐỀ BÀI</p>}
      editor={<textarea aria-label="Ô soạn code" defaultValue="" />}
    />,
  )
  return { ...view, onRail }
}

describe('Workspace — FR-E1 (rộng)', () => {
  it('màn hình rộng: rail + split có vạch chia, không có dải tab', () => {
    stubViewport(false)
    renderWorkspace()

    expect(screen.getByRole('separator')).toBeInTheDocument()
    expect(screen.getByTestId('split-pane')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByText('ĐỀ BÀI')).toBeInTheDocument()
    expect(screen.getByLabelText('Ô soạn code')).toBeInTheDocument()
  })

  it('theo dõi thay đổi cỡ màn hình: rộng → hẹp đổi sang tab', () => {
    const viewport = stubViewport(false)
    renderWorkspace()
    expect(screen.getByRole('separator')).toBeInTheDocument()

    viewport.emit(true)

    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })
})

describe('Workspace — FR-E9 (hẹp < 900px)', () => {
  it('đổi thành hai tab Nội dung / Code, nhãn tab Nội dung theo mục đang hiển thị', () => {
    stubViewport(true)
    renderWorkspace('Bảng xếp hạng')

    expect(screen.queryByTestId('split-pane')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Nội dung: Bảng xếp hạng/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Code' })).toHaveAttribute('aria-selected', 'false')
  })

  it('thanh icon giữ nguyên khi hẹp (không thành Drawer)', () => {
    stubViewport(true)
    renderWorkspace()

    expect(screen.getByRole('navigation', { name: 'rail' })).toBeInTheDocument()
  })

  it('đổi tab KHÔNG tháo editor khỏi cây — code đang gõ không mất', async () => {
    const user = userEvent.setup()
    stubViewport(true)
    renderWorkspace()

    await user.click(screen.getByRole('tab', { name: 'Code' }))
    const editor = screen.getByLabelText('Ô soạn code')
    await user.type(editor, 'int main()')
    expect(editor).toHaveValue('int main()')

    await user.click(screen.getByRole('tab', { name: /Nội dung/ }))

    // Panel bị ẩn bằng CSS chứ không unmount: vẫn đúng node cũ, vẫn giữ nguyên nội dung.
    expect(screen.getByTestId('workspace-panel-editor')).not.toBeVisible()
    expect(screen.getByLabelText('Ô soạn code')).toBe(editor)
    expect(editor).toHaveValue('int main()')

    await user.click(screen.getByRole('tab', { name: 'Code' }))
    expect(screen.getByTestId('workspace-panel-editor')).toBeVisible()
    expect(screen.getByLabelText('Ô soạn code')).toHaveValue('int main()')
  })

  it('bấm icon trên rail khi đang ở tab Code thì quay về tab Nội dung', async () => {
    const user = userEvent.setup()
    stubViewport(true)
    const { onRail } = renderWorkspace()

    await user.click(screen.getByRole('tab', { name: 'Code' }))
    expect(screen.getByRole('tab', { name: 'Code' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('button', { name: 'Trợ giúp' }))

    expect(onRail).toHaveBeenCalledTimes(1) // rail vẫn nhận được cú bấm của mình
    expect(screen.getByRole('tab', { name: /Nội dung/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('mục đổi từ nơi khác (contentLabel đổi) cũng kéo về tab Nội dung', async () => {
    const user = userEvent.setup()
    stubViewport(true)
    const { rerender } = renderWorkspace('Đề bài')

    await user.click(screen.getByRole('tab', { name: 'Code' }))
    rerender(
      <Workspace
        storageKey="bcn:test-workspace"
        contentLabel="Trợ giúp"
        rail={<nav aria-label="rail" />}
        content={<p>ĐỀ BÀI</p>}
        editor={<textarea aria-label="Ô soạn code" defaultValue="" />}
      />,
    )

    expect(screen.getByRole('tab', { name: /Nội dung: Trợ giúp/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('chuyển tab được bằng phím mũi tên (NFR-6)', () => {
    stubViewport(true)
    renderWorkspace()
    const contentTab = screen.getByRole('tab', { name: /Nội dung/ })

    // Roving tabindex: chỉ tab đang chọn nằm trong luồng Tab.
    expect(contentTab).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Code' })).toHaveAttribute('tabindex', '-1')

    fireEvent.keyDown(contentTab, { key: 'ArrowRight' })

    const codeTab = screen.getByRole('tab', { name: 'Code' })
    expect(codeTab).toHaveAttribute('aria-selected', 'true')
    expect(codeTab).toHaveFocus()
  })
})
