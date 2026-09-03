// Markdown + LaTeX → HTML đã lọc, cho đề bài và lời giải.
//
// Đường ống chép từ `src/components/math/rendering.ts` của imath-test và bỏ hết phần riêng của
// nó (bảng biến thiên, nhánh MathJax cũ, node Tiptap). Bốn bước, đúng thứ tự này:
//
//   1. RÚT công thức ra khỏi nguồn, thay bằng ký hiệu chỗ trống;
//   2. `marked` xử lý phần Markdown còn lại (kèm highlight.js cho khối code);
//   3. CẮM lại công thức đã dựng bằng KaTeX vào đúng chỗ;
//   4. lọc toàn bộ HTML bằng DOMPurify.
//
// BƯỚC 1 LÀ LÝ DO CẢ TỆP NÀY TỒN TẠI. Nếu để `marked` chạy trước, `a_1 * b_1` biến thành
// `a<em>1 </em> b_1` — dấu `_` thành in nghiêng, dấu `*` thành in đậm, và công thức tới tay
// KaTeX đã hỏng. Với đề toán tin thì `_` (chỉ số `a_i`) và `*` (dấu nhân) có mặt ở gần như mọi
// công thức, nên đây không phải trường hợp hiếm — đây là trường hợp thường.
import hljs from 'highlight.js/lib/core';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import { Marked, type Tokens } from 'marked';

import { katexRenderOptions, loadKatex, type KatexRenderer } from './katex';
import { sanitizeHtml } from './sanitize';

// Chỉ đăng ký năm ngôn ngữ mà judge thực sự chấm (xem `server/src/judge/languages.ts`) cộng
// javascript cho ví dụ trong tài liệu. Gói `highlight.js` đầy đủ là ~190 ngôn ngữ / hơn 1 MB;
// nhập từ `lib/core` rồi tự đăng ký giữ phần này ở mức vài chục KB.
const HIGHLIGHT_LANGUAGES = { c, cpp, java, javascript, python } as const;

for (const [name, definition] of Object.entries(HIGHLIGHT_LANGUAGES)) {
  // `registerLanguage` kéo theo cả bí danh do chính module ngôn ngữ khai báo, nên `c++`, `py`,
  // `js` chạy được mà không phải liệt kê thêm.
  hljs.registerLanguage(name, definition);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Dựng một khối code có tô màu.
 *
 * Phải tự escape khi không nhận ra ngôn ngữ: `#include <iostream>` mà không escape thì DOMPurify
 * ở bước 4 coi `<iostream>` là thẻ lạ và XOÁ HẲN — người đọc mất nguyên dòng code, chứ không
 * phải chỉ mất màu. (`hljs.highlight` tự escape phần nó sinh ra.)
 */
function renderCodeBlock(code: string, lang: string | undefined): string {
  const requested = (lang ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const known = requested !== '' && hljs.getLanguage(requested) !== undefined;
  const body = known
    ? // `ignoreIllegals` vì đây là code người dùng nộp/dán: nó có quyền sai cú pháp, và một bài
      // nộp lỗi không được phép làm hỏng cả trang đề.
      hljs.highlight(code, { language: requested, ignoreIllegals: true }).value
    : escapeHtml(code);
  const className = known ? `hljs language-${requested}` : 'hljs';
  return `<pre><code class="${className}">${body}</code></pre>\n`;
}

const markdown = new Marked({
  gfm: true,
  // Đề bài được mentor gõ trong textarea, xuống dòng ở đó là xuống dòng thật — giống imath-test.
  breaks: true,
  renderer: {
    code(token: Tokens.Code): string {
      return renderCodeBlock(token.text, token.lang);
    },
  },
});

interface MathSpan {
  readonly tex: string;
  readonly display: boolean;
}

interface SourceChunk {
  readonly text: string;
  /** `true` = khối code có rào ```, phải giữ nguyên xi. */
  readonly isCode: boolean;
}

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Tách nguồn thành các đoạn văn xuôi và các khối code có rào.
 *
 * Cần thiết vì bộ quét công thức KHÔNG được nhòm vào trong khối code: một chương trình C in ra
 * `printf("$%d\n", x)` hay một script shell dùng `$i` sẽ bị đọc nhầm thành công thức, và đoạn
 * code hiện lên trang dưới dạng một phân số vô nghĩa.
 */
function splitByFences(source: string): SourceChunk[] {
  const chunks: SourceChunk[] = [];
  let buffer: string[] = [];
  let bufferIsCode = false;
  let openFence: string | null = null;

  const flush = (): void => {
    if (buffer.length === 0) return;
    chunks.push({ text: buffer.join('\n'), isCode: bufferIsCode });
    buffer = [];
  };

  for (const line of source.split('\n')) {
    if (openFence === null) {
      const opened = FENCE_OPEN.exec(line)?.[1];
      if (opened !== undefined) {
        flush();
        bufferIsCode = true;
        openFence = opened;
      } else if (bufferIsCode) {
        flush();
        bufferIsCode = false;
      }
      buffer.push(line);
      continue;
    }
    buffer.push(line);
    // Rào đóng phải cùng ký tự và dài ít nhất bằng rào mở — đúng luật CommonMark, và nhờ nó
    // một dòng ```` ``` ```` bên trong khối ````~~~```` không đóng nhầm khối.
    const closing = new RegExp(`^ {0,3}${openFence.charAt(0) === '`' ? '`' : '~'}{${openFence.length},}\\s*$`);
    if (closing.test(line)) {
      flush();
      bufferIsCode = false;
      openFence = null;
    }
  }
  flush();
  return chunks;
}

/**
 * Sinh hàm tạo ký hiệu chỗ trống chắc chắn không đụng nội dung nguồn.
 *
 * Dùng khoảng Private Use Area (`\uE000`) và nới dần cho tới khi nguồn không chứa nó nữa: nếu
 * ký hiệu trùng với một chuỗi có sẵn trong đề, bước cắm-lại ở cuối sẽ thay nhầm chỗ.
 */
function makeMarkerFactory(source: string): (index: number) => string {
  let open = '\uE000';
  while (source.includes(open)) open += '\uE000';
  return (index) => `${open}M${index}\uE001`;
}

/** Vị trí dấu `$` đóng của công thức inline, hoặc -1. Công thức inline không vắt qua dòng. */
function findInlineDollar(text: string, from: number): number {
  for (let i = from; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (ch === '\\') {
      i += 1; // `\$` là dấu đô la thường, không phải dấu đóng
      continue;
    }
    if (ch === '\n') return -1;
    if (ch === '$') return i;
  }
  return -1;
}

/**
 * Nội dung giữa hai dấu `$` có đáng coi là công thức không.
 *
 * Đây là mẹo chuẩn để "Lệ phí $5 và $10" không biến thành công thức "5 và ": công thức thật
 * không bao giờ mở bằng khoảng trắng hay đóng bằng khoảng trắng.
 */
function looksLikeInlineMath(tex: string, charAfterClose: string): boolean {
  if (tex.trim() === '') return false;
  if (/^\s/.test(tex) || /\s$/.test(tex)) return false;
  // "$100 $200" — dấu đóng dính ngay vào một chữ số cũng là tiền, không phải toán.
  if (/\d/.test(charAfterClose)) return false;
  return true;
}

/**
 * Quét một đoạn văn xuôi, rút mọi công thức ra `spans` và trả về văn bản đã thay bằng ký hiệu.
 *
 * Viết tay thay vì chuỗi `String.replace` với regex (cách imath-test làm) vì ở đây còn phải bỏ
 * qua code inline giữa hai dấu nháy ngược: đề toán tin viết `` `a_i * 2` `` để chỉ tên biến
 * trong code rất nhiều, và regex thì không đếm được cặp nháy ngược.
 */
function extractMath(text: string, spans: MathSpan[], marker: (index: number) => string): string {
  let out = '';
  let i = 0;

  const push = (tex: string, display: boolean): string => {
    const index = spans.length;
    spans.push({ tex: tex.trim(), display });
    return marker(index);
  };

  // THỨ TỰ ĐỌC LÀ MỘT PHẦN CỦA HỢP ĐỒNG: `$$` phải được xét trước `$`. Bộ quét đọc từ
  // trái sang, gặp `$` trước sẽ nuốt mất nửa đầu của một khối `$$…$$`.
  //
  // Nhận cả `\(…\)` / `\[…\]` vì đề toán tin thường dán từ LaTeX hoặc Overleaf, nơi
  // `$…$` đã bị coi là lối viết cũ.
  while (i < text.length) {
    const ch = text.charAt(i);

    // Code inline: `...` hoặc ``...`` — giữ nguyên, không nhòm vào trong.
    if (ch === '`') {
      const runStart = i;
      while (text.charAt(i) === '`') i += 1;
      const run = text.slice(runStart, i);
      const close = text.indexOf(run, i);
      if (close === -1) {
        out += run;
        continue;
      }
      out += text.slice(runStart, close + run.length);
      i = close + run.length;
      continue;
    }

    if (ch === '\\') {
      const next = text.charAt(i + 1);
      if (next === '(' || next === '[') {
        const display = next === '[';
        const closer = display ? '\\]' : '\\)';
        const close = text.indexOf(closer, i + 2);
        if (close !== -1) {
          out += push(text.slice(i + 2, close), display);
          i = close + 2;
          continue;
        }
      }
      // Ký tự đã thoát (`\$`, `\\`, `\*`): copy nguyên cả cặp để bước sau không đọc lại dấu `$`.
      out += next === '' ? ch : ch + next;
      i += next === '' ? 1 : 2;
      continue;
    }

    if (ch === '$') {
      if (text.charAt(i + 1) === '$') {
        const close = text.indexOf('$$', i + 2);
        if (close !== -1 && text.slice(i + 2, close).trim() !== '') {
          out += push(text.slice(i + 2, close), true);
          i = close + 2;
          continue;
        }
        out += '$$';
        i += 2;
        continue;
      }
      const close = findInlineDollar(text, i + 1);
      if (close !== -1 && looksLikeInlineMath(text.slice(i + 1, close), text.charAt(close + 1))) {
        out += push(text.slice(i + 1, close), false);
        i = close + 1;
        continue;
      }
    }

    out += ch;
    i += 1;
  }

  return out;
}

function renderMathSpan(katex: KatexRenderer | null, span: MathSpan): string {
  if (katex !== null) {
    try {
      return katex.renderToString(span.tex, katexRenderOptions(span.display));
    } catch (error) {
      console.error('[bcn-judge] KaTeX ném khi dựng công thức:', span.tex, error);
    }
  }
  // KaTeX không nạp được, hoặc ném dù đã `throwOnError: false`. In nguyên chữ ra: đề đọc xấu
  // vẫn hơn đề trắng bảng — nhất là khi CDN hỏng đúng giờ contest.
  const tag = span.display ? 'div' : 'span';
  return `<${tag} class="markdown-math-raw">${escapeHtml(span.tex)}</${tag}>`;
}

/**
 * Markdown + LaTeX → HTML đã lọc, sẵn sàng cho `dangerouslySetInnerHTML`.
 *
 * Bất đồng bộ vì KaTeX được nạp lười (xem `katex.ts`); trượt mạng thì hàm vẫn trả HTML, chỉ là
 * công thức hiện dưới dạng chữ thô. Không bao giờ ném.
 */
export async function renderMarkdown(source: string): Promise<string> {
  const katex = await loadKatex();
  const marker = makeMarkerFactory(source);
  const spans: MathSpan[] = [];

  const protectedSource = splitByFences(source)
    .map((chunk) => (chunk.isCode ? chunk.text : extractMath(chunk.text, spans, marker)))
    .join('\n');

  let html = markdown.parse(protectedSource, { async: false });

  spans.forEach((span, index) => {
    const rendered = renderMathSpan(katex, span);
    const placeholder = marker(index);
    // `split`/`join` chứ không `String.replace`: HTML của KaTeX chứa `$` (bản LaTeX gốc nằm
    // trong `<annotation>`), mà trong chuỗi thay thế của `replace` thì `$&`, `$1`… là ký hiệu
    // đặc biệt — dùng `replace` là công thức tự cắt xén chính nó.
    //
    // Gỡ lớp `<p>` trước: công thức khối đứng riêng một dòng được `marked` bọc thành cả một
    // đoạn văn, và để nguyên thì phần căn giữa của KaTeX bị lề đoạn văn đẩy lệch.
    html = html.split(`<p>${placeholder}</p>`).join(rendered);
    html = html.split(placeholder).join(rendered);
  });

  return sanitizeHtml(html);
}
