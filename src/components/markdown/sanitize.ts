// Lọc HTML trước khi nó đi vào `dangerouslySetInnerHTML`.
//
// Đề bài do mentor soạn, nhưng đề bài KHÔNG phải là mã tin cậy: mentor dán nội dung từ nguồn
// ngoài, và bản thân đề còn đi qua import zip (`server/src/lib/zipImport.ts`) — tức là một tệp
// .md bất kỳ ai gửi cũng có thể tới đây. Đây là chốt chặn cuối cùng giữa Markdown và DOM.
//
// Chép nguyên tinh thần `src/components/math/sanitize.ts` của imath-test: DOMPurify với danh
// sách thẻ MathML mà KaTeX sinh ra được nới thêm, phần còn lại để mặc định.
import DOMPurify from 'dompurify';

// DOMPurify mặc định đã cho qua bộ MathML lõi (`math`, `mrow`, `mi`, `mo`, `mn`, `mfrac`, …)
// nhưng THIẾU đúng hai thẻ mà KaTeX luôn bọc quanh cây MathML của nó ở chế độ
// `output: 'htmlAndMathml'`. Mất `<annotation>` là mất luôn bản LaTeX gốc dùng cho copy-paste
// và cho trình đọc màn hình; mất `<semantics>` là cả cây MathML bị san phẳng thành chữ.
const KATEX_MATHML_TAGS = ['semantics', 'annotation', 'annotation-xml', 'mprescripts', 'none'];

// `class` + `style` là toàn bộ cách KaTeX dựng hình: nó không dùng thẻ riêng mà xếp chồng
// `<span>` với chiều cao/lề tính bằng em trong thuộc tính `style`. Bỏ `style` đi thì công thức
// vẫn còn chữ nhưng phân số, căn, chỉ số trên/dưới chồng đè lên nhau — không đọc được.
// `aria-hidden` giữ để phần HTML nhìn-được không bị trình đọc màn hình đọc trùng với MathML.
const KATEX_ATTRS = ['class', 'style', 'aria-hidden', 'encoding', 'xmlns', 'display'];

/**
 * Trả về HTML đã lọc: bỏ `<script>`, bỏ mọi handler `on*`, bỏ URL `javascript:`
 * (đều là hành vi mặc định của DOMPurify — ta chỉ nới thêm đúng phần KaTeX cần).
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: KATEX_MATHML_TAGS,
    ADD_ATTR: KATEX_ATTRS,
    // Trả chuỗi, không trả DocumentFragment — phía gọi cần chuỗi cho `dangerouslySetInnerHTML`.
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });
}
