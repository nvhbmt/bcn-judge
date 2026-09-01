import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Markdown } from '@/components/markdown/Markdown';
import { renderMarkdown } from '@/components/markdown/render';

/** Dựng HTML rồi trả về một phần tử thật để truy vấn bằng DOM thay vì so khớp chuỗi. */
async function renderToDom(source: string): Promise<HTMLElement> {
  const host = document.createElement('div');
  host.innerHTML = await renderMarkdown(source);
  return host;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('renderMarkdown — Markdown cơ bản', () => {
  it('dựng tiêu đề theo đúng cấp', async () => {
    const dom = await renderToDom('# Bài A\n\n## Dữ liệu vào');
    expect(dom.querySelector('h1')?.textContent).toBe('Bài A');
    expect(dom.querySelector('h2')?.textContent).toBe('Dữ liệu vào');
  });

  it('dựng danh sách có thứ tự và không thứ tự', async () => {
    const dom = await renderToDom('- một\n- hai\n\n1. ba\n2. bốn');
    expect(dom.querySelectorAll('ul > li')).toHaveLength(2);
    expect(dom.querySelectorAll('ol > li')).toHaveLength(2);
  });

  it('dựng bảng GFM đủ ô tiêu đề và ô dữ liệu', async () => {
    const dom = await renderToDom(['| Vào | Ra |', '| --- | --- |', '| 3 | 9 |'].join('\n'));
    expect(dom.querySelectorAll('table')).toHaveLength(1);
    expect([...dom.querySelectorAll('th')].map((el) => el.textContent)).toEqual(['Vào', 'Ra']);
    expect([...dom.querySelectorAll('td')].map((el) => el.textContent)).toEqual(['3', '9']);
  });

  it('dựng blockquote', async () => {
    const dom = await renderToDom('> Chú ý: n có thể bằng 0.');
    expect(dom.querySelector('blockquote')?.textContent).toContain('n có thể bằng 0');
  });
});

describe('renderMarkdown — khối code', () => {
  it('gắn class của highlight.js cho khối ```c', async () => {
    const dom = await renderToDom('```c\nint main(void) { return 0; }\n```');
    const code = dom.querySelector('pre > code');
    expect(code?.className).toBe('hljs language-c');
    // Có ít nhất một token được tô — nếu không thì highlight.js đã không thực sự chạy.
    expect(code?.querySelectorAll('span[class^="hljs-"]').length).toBeGreaterThan(0);
  });

  it('tô được cả cpp và python', async () => {
    const cpp = await renderToDom('```cpp\n#include <iostream>\n```');
    expect(cpp.querySelector('pre > code')?.className).toBe('hljs language-cpp');
    const py = await renderToDom('```python\nprint(1)\n```');
    expect(py.querySelector('pre > code')?.className).toBe('hljs language-python');
  });

  it('giữ nguyên văn bản code khi không nhận ra ngôn ngữ (không bị bộ lọc nuốt)', async () => {
    const dom = await renderToDom('```brainfuck\n#include <iostream>\n```');
    const code = dom.querySelector('pre > code');
    expect(code?.className).toBe('hljs');
    // Nếu quên escape thì `<iostream>` là thẻ lạ và DOMPurify xoá hẳn — mất nguyên dòng code.
    expect(code?.textContent).toContain('#include <iostream>');
  });
});

describe('renderMarkdown — công thức toán', () => {
  it('dựng công thức inline `$x^2$` bằng KaTeX', async () => {
    const dom = await renderToDom('Diện tích là $x^2$ đơn vị.');
    expect(dom.querySelector('.katex')).not.toBeNull();
    expect(dom.querySelector('.katex-display')).toBeNull();
    expect(dom.textContent).toContain('Diện tích là');
  });

  it('dựng công thức khối `$$\\frac{a}{b}$$` ở chế độ display', async () => {
    const dom = await renderToDom('$$\\frac{a}{b}$$');
    expect(dom.querySelector('.katex-display')).not.toBeNull();
  });

  it('nhận cả cặp dấu \\(…\\) và \\[…\\]', async () => {
    const inline = await renderToDom('Cho \\(n \\le 10\\).');
    expect(inline.querySelector('.katex')).not.toBeNull();
    expect(inline.querySelector('.katex-display')).toBeNull();

    const display = await renderToDom('\\[ S = \\sum a_i \\]');
    expect(display.querySelector('.katex-display')).not.toBeNull();
  });

  it('KHÔNG coi giá tiền "$5 và $10" là công thức', async () => {
    const dom = await renderToDom('Lệ phí $5 và $10 mỗi lượt.');
    expect(dom.querySelector('.katex')).toBeNull();
    expect(dom.textContent).toContain('$5 và $10');
  });
});

describe('renderMarkdown — bảo vệ công thức khỏi bộ phân tích Markdown', () => {
  /** Bản LaTeX gốc mà KaTeX nhúng lại vào MathML — bằng chứng công thức tới tay nó còn nguyên. */
  function annotationOf(dom: HTMLElement): string | undefined {
    return dom.querySelector('annotation')?.textContent ?? undefined;
  }

  it('giữ nguyên `_` và `*` trong công thức inline', async () => {
    const dom = await renderToDom('Tổng $a_1 * b_1 + a_2 * b_2$ là kết quả.');
    // Không có `marked` bảo vệ thì `_1 * b_1 + a_2 *` thành in nghiêng/in đậm.
    expect(dom.querySelector('em')).toBeNull();
    expect(dom.querySelector('strong')).toBeNull();
    expect(annotationOf(dom)).toBe('a_1 * b_1 + a_2 * b_2');
  });

  it('giữ nguyên `_` và `*` trong công thức khối nhiều dòng', async () => {
    const dom = await renderToDom('$$\n\\sum_{i=1}^{n} a_i * b_i\n$$');
    expect(dom.querySelector('em')).toBeNull();
    expect(annotationOf(dom)).toBe('\\sum_{i=1}^{n} a_i * b_i');
  });

  it('không đụng tới dấu `$` nằm trong khối code', async () => {
    const dom = await renderToDom('```c\nprintf("$%d$ và a_i * 2\\n", x);\n```');
    expect(dom.querySelector('.katex')).toBeNull();
    expect(dom.querySelector('em')).toBeNull();
    expect(dom.querySelector('pre > code')?.textContent).toContain('$%d$ và a_i * 2');
  });

  it('không đụng tới dấu `$` nằm trong code inline', async () => {
    const dom = await renderToDom('Biến `$x_1 * 2$` trong script.');
    expect(dom.querySelector('.katex')).toBeNull();
    expect(dom.querySelector('code')?.textContent).toBe('$x_1 * 2$');
  });

  it('vẫn xử lý Markdown bình thường ở phần văn xuôi quanh công thức', async () => {
    const dom = await renderToDom('**Đậm** rồi $a_1$ rồi *nghiêng*.');
    expect(dom.querySelector('strong')?.textContent).toBe('Đậm');
    expect(dom.querySelector('em')?.textContent).toBe('nghiêng');
    expect(dom.querySelector('.katex')).not.toBeNull();
  });
});

describe('renderMarkdown — KaTeX nạp trượt', () => {
  it('in công thức thành chữ thô thay vì ném hoặc để trắng', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.resetModules();
    // Giả lập CDN hỏng: `import('katex')` đổ ở cả hai lần thử.
    vi.doMock('katex', () => {
      throw new Error('mô phỏng CDN hỏng');
    });
    try {
      const { renderMarkdown: renderWithoutKatex } = await import('@/components/markdown/render');
      const html = await renderWithoutKatex('Tổng $a_1 * b_1$ và:\n\n$$\\frac{a}{b}$$');
      // Đề vẫn dựng được, chỉ là công thức hiện dạng chữ — tuyệt đối không được trả chuỗi rỗng.
      expect(html).toContain('<p>');
      expect(html).toContain('markdown-math-raw');
      expect(html).toContain('a_1 * b_1');
      expect(html).toContain('\\frac{a}{b}');
      expect(html).not.toContain('katex');
      expect(html).toContain('Tổng');
    } finally {
      vi.doUnmock('katex');
      vi.resetModules();
    }
  });
});

describe('renderMarkdown — lọc XSS', () => {
  it('bỏ hẳn thẻ <script>', async () => {
    const html = await renderMarkdown('Trước<script>alert(1)</script>Sau');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
  });

  it('bỏ handler on* trên thẻ ảnh', async () => {
    const html = await renderMarkdown('<img src=x onerror=alert(1)>');
    expect(html.toLowerCase()).not.toContain('onerror');
  });

  it('bỏ URL javascript: trong liên kết Markdown', async () => {
    const html = await renderMarkdown('[bấm vào đây](javascript:alert(1))');
    expect(html.toLowerCase()).not.toContain('javascript:');
    expect(html).toContain('bấm vào đây');
  });

  it('bỏ handler on* nhét lẫn trong nội dung hợp lệ', async () => {
    const html = await renderMarkdown('# Đề\n\n<div onclick="alert(1)">nội dung</div>');
    expect(html.toLowerCase()).not.toContain('onclick');
    expect(html).toContain('nội dung');
  });
});

describe('<Markdown />', () => {
  it('hiện chữ thô trước, rồi thay bằng HTML đã dựng', async () => {
    const source = '# Bài A\n\nCho $x^2$.';
    const { container } = render(<Markdown source={source} />);

    // Nhịp đầu: chưa có HTML, nhưng KHÔNG được trắng.
    const first = container.firstElementChild;
    expect(first?.getAttribute('data-markdown-state')).toBe('pending');
    expect(first?.textContent).toBe(source);
    expect(first?.querySelector('h1')).toBeNull();

    await waitFor(() => {
      expect(container.firstElementChild?.getAttribute('data-markdown-state')).toBe('ready');
    });
    expect(container.querySelector('h1')?.textContent).toBe('Bài A');
    expect(container.querySelector('.katex')).not.toBeNull();
  });

  it('dựng lại khi `source` đổi', async () => {
    const { rerender } = render(<Markdown source="# Bài A" />);
    await waitFor(() => expect(screen.getByRole('heading').textContent).toBe('Bài A'));

    rerender(<Markdown source="# Bài B" />);
    await waitFor(() => expect(screen.getByRole('heading').textContent).toBe('Bài B'));
  });

  it('nhận `className` mà vẫn giữ class gốc', async () => {
    const { container } = render(<Markdown source="xin chào" className="statement" />);
    expect(container.firstElementChild?.className).toBe('markdown-body statement');
  });

  it('tháo giữa chừng thì không báo lỗi (không setState sau khi unmount)', async () => {
    const onError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(<Markdown source="# Bài A" />);
    unmount();
    // Đủ lâu để lời hứa dựng HTML hoàn tất sau khi component đã biến mất.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onError).not.toHaveBeenCalled();
  });
});
