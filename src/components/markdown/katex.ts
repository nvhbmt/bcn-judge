// Nạp KaTeX — MỘT lần cho cả trang, có thử lại, và không để CSS kéo theo JS.
//
// Chép nguyên bài học của `src/components/math/loadKatex.ts` bên imath-test. Ở đó, bản đầu tiên
// gọi thẳng `Promise.all([import(css), import('katex')])` ngay trong mỗi ô công thức, và một
// nhịp mạng rớt là hỏng theo ba kiểu cùng lúc:
//
//   - hỏng vĩnh viễn: không có lần thử lại nào, mã LaTeX nằm đó tới khi tải lại trang;
//   - hỏng cả trang: mọi công thức cùng gọi một lượt nên cùng trượt một lúc;
//   - hỏng vì CSS: `Promise.all` đổ khi CHỈ MỖI tệp CSS trượt, dù JS dựng công thức vẫn tải
//     được — thiếu CSS thì công thức xấu chứ vẫn đọc được, đổi lại là mã LaTeX trần.
//
// Ở bcn-judge hậu quả nặng hơn imath một bậc: KaTeX hỏng lúc đang thi thì đề bài trắng bảng,
// nên hàm nạp ở đây KHÔNG BAO GIỜ ném — nó trả `null` và phía render tự lùi về chữ thô.
import type { KatexOptions } from 'katex';

/**
 * Bề mặt KaTeX mà module này thực sự dùng.
 *
 * Khai riêng thay vì `typeof import('katex').default` để `render.ts` không bị buộc phải biết
 * hình dạng đầy đủ của gói — và để test giả lập được bằng một object hai dòng.
 */
export interface KatexRenderer {
  renderToString(tex: string, options?: KatexOptions): string;
}

/**
 * Tuỳ chọn dùng chung cho mọi lần gọi KaTeX.
 *
 * `throwOnError: false` là bắt buộc: một dấu ngoặc thiếu trong đề sẽ hiện thành đoạn LaTeX đỏ
 * tại chỗ, chứ không được phép làm hỏng cả trang đề. `trust: false` chặn `\href`/`\includegraphics`
 * — chúng là đường tiêm URL `javascript:` đi vòng qua bộ lọc HTML.
 */
export function katexRenderOptions(displayMode: boolean): KatexOptions {
  return {
    displayMode,
    throwOnError: false,
    trust: false,
    strict: false,
    output: 'htmlAndMathml',
  };
}

const RETRY_DELAY_MS = 400;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Gọi `load()`, trượt thì chờ một nhịp rồi thử LẠI ĐÚNG MỘT LẦN — mạng trường rớt là chuyện thường. */
async function importWithRetry<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch {
    await wait(RETRY_DELAY_MS);
    return await load();
  }
}

let cached: KatexRenderer | null = null;
let pending: Promise<KatexRenderer | null> | null = null;
let cssStarted = false;

function startCssLoad(): void {
  if (cssStarted) return;
  cssStarted = true;
  // CSS đi đường RIÊNG và được phép trượt: thiếu nó thì công thức xấu, còn thiếu JS mới là
  // không đọc được gì. `void` + `catch` rỗng là cố ý — không ai được chờ nó, không ai được đổ vì nó.
  void importWithRetry(() => import('katex/dist/katex.min.css')).catch(() => {});
}

/**
 * KaTeX đã nạp, hoặc đang nạp, hoặc `null` nếu nạp trượt cả hai lần.
 *
 * KHÔNG BAO GIỜ ném. Phía gọi nhận `null` thì in nguyên chữ trong công thức ra — trang đề đọc
 * xấu vẫn hơn trang đề trắng, nhất là khi CDN hỏng đúng giờ contest.
 *
 * Nạp trượt thì XOÁ lượt đang giữ, để lần gọi sau (đề khác, hoặc lúc máy có mạng lại) được thử
 * lại thật sự thay vì nhận lại đúng lời hứa đã hỏng.
 */
export function loadKatex(): Promise<KatexRenderer | null> {
  if (cached) return Promise.resolve(cached);
  startCssLoad();
  if (!pending) {
    pending = importWithRetry(() => import('katex'))
      .then((module) => {
        cached = module.default;
        return cached;
      })
      .catch((error: unknown) => {
        pending = null;
        // Để lại dấu vết trong console: khi có người báo "đề hiện ra mã LaTeX", đây là câu duy
        // nhất phân biệt được "mạng rớt" với "đề viết sai công thức".
        console.error('[bcn-judge] Không nạp được KaTeX — công thức sẽ hiện dạng chữ thô.', error);
        return null;
      });
  }
  return pending;
}
