/**
 * Editor phải tô màu bằng ĐÚNG token của hệ thiết kế, ở cả hai bản sáng/tối.
 *
 * Chốt sự cố: bảng `synHighlight` từng chỉ khai tám dòng rồi để
 * `syntaxHighlighting(defaultHighlightStyle, { fallback: true })` đỡ phần còn lại.
 * Bảng mặc định của CodeMirror là màu nguyên chất cho nền trắng của chính nó —
 * `definition(variableName)` ra `#00f`, `local(variableName)` ra `#30a`,
 * `comment` ra `#940` — nên trên nền kem của bản sáng, `int main` thành tím-xanh chói
 * đứng cạnh `#include` nâu ấm. Bốn token `--syn-*` vẫn đạt 6,9–8,1:1 trên nền
 * `#fcfaf5`; thứ hỏng là những tag KHÔNG được khai, chứ không phải màu đã khai.
 *
 * Hai điều test canh, và canh được tự động:
 *   1. không màu nào của bảng mặc định lọt vào stylesheet;
 *   2. mọi vai cú pháp đều có màu, và màu ấy là token — nên đổi theme là nó đi theo.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CodeEditor } from '@/components/editor/CodeEditor'

afterEach(cleanup)

/**
 * Màu nguyên văn trong `defaultHighlightStyle` của @codemirror/language.
 *
 * So bằng regex có ranh giới từ, KHÔNG bằng `includes`: base theme của CodeMirror có
 * `#00ffff8a` (tô kết quả tìm), mà chuỗi đó CHỨA `#00f` — kiểm bằng `includes` thì
 * test đỏ ngay cả khi sản phẩm đúng, và đó là thứ đầu tiên tôi làm sai ở đây.
 */
const CODEMIRROR_DEFAULTS = ['#00f', '#00c', '#708', '#940', '#30a', '#219', '#164', '#a11', '#e40', '#085', '#167', '#256']

function injectedCss(): string {
  return [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n')
}

const SOURCE = `#include <stdio.h>

int main(void) {
    int n = 0;
    scanf("%d", &n);   // đọc n
    printf("%d\\n", n * 2);
    return 0;
}
`

function mount(theme: 'light' | 'dark') {
  render(<CodeEditor value={SOURCE} languageId="c11" theme={theme} onChange={() => {}} ariaLabel="Mã nguồn" />)
}

describe('bảng màu cú pháp của editor', () => {
  it.each(['light', 'dark'] as const)('bản %s không để lọt màu mặc định của CodeMirror', (theme) => {
    mount(theme)
    const css = injectedCss()
    for (const hex of CODEMIRROR_DEFAULTS) {
      const leaked = new RegExp(`color:\\s*${hex}\\b`, 'i').test(css)
      expect(leaked, `stylesheet còn màu mặc định ${hex}`).toBe(false)
    }
  })

  it.each(['light', 'dark'] as const)('bản %s: vùng chọn và dòng đang gõ KHÔNG dùng chung màu', (theme) => {
    mount(theme)
    const css = injectedCss()
    // Bôi đen ngay trên dòng đang gõ mà hai thứ cùng màu thì không thấy gì —
    // design-system tách `--select-bg` khỏi `--surface-sel` đúng vì lẽ đó.
    expect(css.includes('background: var(--select-bg)')).toBe(true)
    expect(css.includes('background-color: var(--surface-sel)')).toBe(false)

    // Và nền dòng đang gõ phải TRONG SUỐT: lớp vùng chọn của CodeMirror ở z-index -2,
    // tức sau nội dung, nên nền đục trên .cm-line che mất vệt bôi đen.
    expect(css.includes('background-color: var(--line-active)')).toBe(true)
  })

  it.each(['light', 'dark'] as const)('bản %s tô đủ mọi vai, và tô bằng token', (theme) => {
    mount(theme)
    const css = injectedCss()
    // Định danh và dấu câu phải được khai TƯỜNG MINH — thiếu chúng chính là chỗ
    // `#00f` lọt vào bản sáng, vì đó là hai loại token dày đặc nhất trong code.
    for (const token of [
      'var(--syn-comment)',
      'var(--syn-keyword)',
      'var(--syn-func)',
      'var(--syn-number)',
      'var(--syn-string)',
      'var(--ink-2)',
      'var(--ink-4)',
    ]) {
      expect(css.includes(`color: ${token}`), `thiếu vai tô màu ${token}`).toBe(true)
    }
  })
})
