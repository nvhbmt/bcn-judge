/** Test cho `src/components/editor/CodeEditor.tsx` — FR-E4, FR-E8, FR-G1. */
import { redo, undo } from '@codemirror/commands'
import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CodeEditor,
  RUN_SHORTCUT,
  SUBMIT_SHORTCUT,
  languageExtension,
} from '@/components/editor/CodeEditor'

afterEach(cleanup)

/** Lấy `EditorView` đang gắn trong container để lái editor như người dùng thật. */
function viewOf(container: HTMLElement): EditorView {
  const view = EditorView.findFromDOM(container)
  if (!view) throw new Error('Không tìm thấy EditorView trong container')
  return view
}

// CodeMirror nhận diện Tab/Escape theo `keyCode` (tab-focus mode), nên event giả
// lập phải mang đúng mã phím chứ không chỉ `key`.
const KEY_CODES: Record<string, number> = {
  Enter: 13,
  Backspace: 8,
  Tab: 9,
  Escape: 27,
  f: 70,
}

/** Gõ một phím vật lý vào vùng nội dung — đi qua đúng keymap của CodeMirror. */
function pressKey(
  view: EditorView,
  key: string,
  modifiers: { ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean } = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    code: key,
    keyCode: KEY_CODES[key] ?? 0,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  })
  view.contentDOM.dispatchEvent(event)
  return event
}

describe('languageExtension', () => {
  it('ánh xạ các mã ngôn ngữ của judge', () => {
    for (const id of ['c11', 'cpp17', 'python3', 'java17', 'node20']) {
      expect(languageExtension(id)).toBeTruthy()
    }
  })

  it('ngôn ngữ lạ trả về extension rỗng, không ném lỗi', () => {
    expect(() => languageExtension('rust1000')).not.toThrow()
    expect(languageExtension('rust1000')).toEqual([])
  })
})

describe('CodeEditor', () => {
  it('mount và hiển thị nội dung ban đầu', () => {
    const { container } = render(
      <CodeEditor value={'int main() {\n  return 0;\n}'} onChange={() => {}} languageId="cpp17" />,
    )
    const view = viewOf(container)
    expect(view.state.doc.toString()).toBe('int main() {\n  return 0;\n}')
    // FR-E4 · số dòng
    expect(container.querySelector('.cm-lineNumbers')).not.toBeNull()
    expect(container.querySelector('.cm-content')?.getAttribute('aria-label')).toBe(
      'Trình soạn code',
    )
  })

  it('nhận ariaLabel tuỳ chỉnh (NFR-6)', () => {
    const { container } = render(
      <CodeEditor value="" onChange={() => {}} languageId="c11" ariaLabel="Ô soạn code bài A" />,
    )
    expect(container.querySelector('.cm-content')?.getAttribute('aria-label')).toBe(
      'Ô soạn code bài A',
    )
  })

  it('gõ trong editor gọi onChange', () => {
    const onChange = vi.fn()
    const { container } = render(<CodeEditor value="abc" onChange={onChange} languageId="c11" />)
    const view = viewOf(container)

    // Gõ ký tự (đi qua cùng đường dispatch mà CodeMirror dùng cho input thật)
    view.dispatch({
      changes: { from: 3, insert: 'd' },
      selection: { anchor: 4 },
      userEvent: 'input.type',
    })
    expect(onChange).toHaveBeenLastCalledWith('abcd')

    // Phím Enter đi qua defaultKeymap → cũng là một lần sửa của người dùng
    pressKey(view, 'Enter')
    expect(onChange).toHaveBeenLastCalledWith('abcd\n')
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('FR-E8 · Ctrl+Enter gọi onRun, Ctrl+Shift+Enter gọi onSubmit', () => {
    const onRun = vi.fn()
    const onSubmit = vi.fn()
    const onChange = vi.fn()
    const { container } = render(
      <CodeEditor
        value="x"
        onChange={onChange}
        languageId="python3"
        onRun={onRun}
        onSubmit={onSubmit}
      />,
    )
    const view = viewOf(container)

    const runEvent = pressKey(view, 'Enter', { ctrlKey: true })
    expect(onRun).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(runEvent.defaultPrevented).toBe(true)

    const submitEvent = pressKey(view, 'Enter', { ctrlKey: true, shiftKey: true })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onRun).toHaveBeenCalledTimes(1)
    expect(submitEvent.defaultPrevented).toBe(true)

    // Phím tắt không được coi là chỉnh sửa tài liệu
    expect(onChange).not.toHaveBeenCalled()
    expect(view.state.doc.toString()).toBe('x')
  })

  it('phím tắt khai báo bằng Mod- nên ⌘ dùng được trên macOS', () => {
    // jsdom luôn báo nền tảng non-mac nên không gõ thẳng ⌘ được; thay vào đó
    // kiểm tra ràng buộc thật: CodeMirror phân giải `Mod-` thành ⌘ trên macOS.
    expect(RUN_SHORTCUT).toBe('Mod-Enter')
    expect(SUBMIT_SHORTCUT).toBe('Mod-Shift-Enter')
  })

  it('FR-E4 · Tab thụt lề, Shift+Tab lùi lề', () => {
    const { container } = render(<CodeEditor value="abc" onChange={() => {}} languageId="c11" />)
    const view = viewOf(container)
    view.dispatch({ selection: EditorSelection.cursor(0) })

    pressKey(view, 'Tab')
    expect(view.state.doc.toString()).toBe('    abc')

    pressKey(view, 'Tab', { shiftKey: true })
    expect(view.state.doc.toString()).toBe('abc')
  })

  it('NFR-6 · Escape rồi Tab thì Tab trả lại cho trình duyệt (không nhốt bàn phím)', () => {
    const { container } = render(<CodeEditor value="abc" onChange={() => {}} languageId="c11" />)
    const view = viewOf(container)
    view.dispatch({ selection: EditorSelection.cursor(0) })

    const escapeEvent = pressKey(view, 'Escape')
    // Escape không bị nuốt: lớp ngoài (thoát toàn màn hình…) vẫn xử lý được
    expect(escapeEvent.defaultPrevented).toBe(false)

    pressKey(view, 'Tab')
    expect(view.state.doc.toString()).toBe('abc')
  })

  it('FR-E4 · undo/redo hoạt động', () => {
    const { container } = render(<CodeEditor value="abc" onChange={() => {}} languageId="c11" />)
    const view = viewOf(container)
    view.dispatch({ selection: EditorSelection.cursor(3) })

    pressKey(view, 'Tab')
    expect(view.state.doc.toString()).not.toBe('abc')
    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('abc')
    expect(redo(view)).toBe(true)
    expect(view.state.doc.toString()).not.toBe('abc')
  })

  it('FR-E4 · mở được ô tìm kiếm bằng Ctrl+F', () => {
    const { container } = render(<CodeEditor value="abc" onChange={() => {}} languageId="c11" />)
    pressKey(viewOf(container), 'f', { ctrlKey: true })
    expect(container.querySelector('.cm-search')).not.toBeNull()
  })

  it('đổi languageId giữ nguyên nội dung, con trỏ và lịch sử undo', () => {
    const { container, rerender } = render(
      <CodeEditor value={'a = 1\nb = 2'} onChange={() => {}} languageId="python3" />,
    )
    const view = viewOf(container)
    view.dispatch({ changes: { from: 5, insert: '0' }, userEvent: 'input.type' })
    view.dispatch({ selection: EditorSelection.cursor(3) })

    rerender(<CodeEditor value={'a = 10\nb = 2'} onChange={() => {}} languageId="cpp17" />)

    // Cùng một view ⇒ không bị dựng lại khi đổi ngôn ngữ
    expect(viewOf(container)).toBe(view)
    expect(view.state.doc.toString()).toBe('a = 10\nb = 2')
    expect(view.state.selection.main.head).toBe(3)
    // …và lịch sử undo của người dùng vẫn còn nguyên
    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('a = 1\nb = 2')
  })

  it('đổi theme sáng/tối không dựng lại editor (FR-E4)', () => {
    const { container, rerender } = render(
      <CodeEditor value="x" onChange={() => {}} languageId="c11" theme="light" />,
    )
    const view = viewOf(container)
    expect(view.state.facet(EditorView.darkTheme)).toBe(false)

    rerender(<CodeEditor value="x" onChange={() => {}} languageId="c11" theme="dark" />)

    expect(viewOf(container)).toBe(view)
    expect(view.state.facet(EditorView.darkTheme)).toBe(true)
    expect(view.state.doc.toString()).toBe('x')
  })

  it('readOnly chặn chỉnh sửa', () => {
    const onChange = vi.fn()
    const { container } = render(
      <CodeEditor value="abc" onChange={onChange} languageId="c11" readOnly />,
    )
    const view = viewOf(container)
    expect(view.state.readOnly).toBe(true)
    expect(view.contentDOM.getAttribute('contenteditable')).toBe('false')

    view.dispatch({ selection: EditorSelection.cursor(3) })
    pressKey(view, 'Backspace')
    pressKey(view, 'Enter')

    expect(view.state.doc.toString()).toBe('abc')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('bật/tắt readOnly qua prop mà không mất nội dung', () => {
    const { container, rerender } = render(
      <CodeEditor value="abc" onChange={() => {}} languageId="c11" readOnly />,
    )
    const view = viewOf(container)
    rerender(<CodeEditor value="abc" onChange={() => {}} languageId="c11" readOnly={false} />)
    expect(view.state.readOnly).toBe(false)
    expect(viewOf(container)).toBe(view)
  })

  it('FR-G1 · đổi value từ ngoài thì thay tài liệu', () => {
    const onChange = vi.fn()
    const { container, rerender } = render(
      <CodeEditor value="cu" onChange={onChange} languageId="c11" />,
    )
    const view = viewOf(container)

    rerender(<CodeEditor value="source cua bai nop cu" onChange={onChange} languageId="c11" />)

    expect(view.state.doc.toString()).toBe('source cua bai nop cu')
    // Nạp từ ngoài không được bắn ngược onChange (tránh vòng lặp với cha)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('value trùng với nội dung hiện tại thì không dispatch (không cướp con trỏ)', () => {
    const { container, rerender } = render(
      <CodeEditor value="abc" onChange={() => {}} languageId="c11" />,
    )
    const view = viewOf(container)
    view.dispatch({ selection: EditorSelection.cursor(1) })

    rerender(<CodeEditor value="abc" onChange={() => {}} languageId="c11" />)

    expect(view.state.selection.main.head).toBe(1)
  })

  it('huỷ mount thì destroy editor', () => {
    const { container, unmount } = render(
      <CodeEditor value="abc" onChange={() => {}} languageId="c11" />,
    )
    unmount()
    expect(container.querySelector('.cm-content')).toBeNull()
  })
})
