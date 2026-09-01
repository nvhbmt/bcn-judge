import { useEffect, useState } from 'react';

import './markdown.css';
import { renderMarkdown } from './render';

export interface MarkdownProps {
  /** Nguồn Markdown + LaTeX (đề bài, lời giải, mô tả contest…). */
  source: string;
  className?: string;
}

/**
 * Hiển thị Markdown + LaTeX đã lọc.
 *
 * `renderMarkdown` bất đồng bộ vì KaTeX nạp lười, nên component phải chịu được khoảng trống
 * giữa hai lần vẽ. Hai luật ở đây đều rút ra từ đúng khoảng trống đó:
 *
 *   1. TRONG LÚC CHỜ, hiện chữ thô — không hiện gì cả. Đề bài là thứ đầu tiên người thi nhìn
 *      thấy khi contest mở; một nhịp trắng bảng (dù chỉ vài chục ms, và lâu hơn nhiều nếu KaTeX
 *      phải thử lại) đọc ra như "trang hỏng", và người thi sẽ F5 giữa giờ thi.
 *   2. KHÔNG `setState` sau khi đã tháo. Người dùng bấm rất nhanh giữa các bài trong danh sách,
 *      nên lần render trước gần như chắc chắn còn đang chạy khi component biến mất.
 */
export function Markdown({ source, className }: MarkdownProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // Đặt lại về `null` NGAY khi `source` đổi: giữ HTML của bài cũ trong lúc chờ bài mới thì
    // người dùng đọc nhầm đề của bài vừa rời đi — sai nguy hiểm hơn là chậm.
    setHtml(null);
    void renderMarkdown(source).then(
      (rendered) => {
        if (alive) setHtml(rendered);
      },
      (error: unknown) => {
        // `renderMarkdown` không được phép ném; tới đây là lỗi thật, ghi lại rồi ở nguyên chế
        // độ chữ thô thay vì để component trắng.
        console.error('[bcn-judge] Không dựng được Markdown:', error);
      },
    );
    return () => {
      alive = false;
    };
  }, [source]);

  const classes = className === undefined ? 'markdown-body' : `markdown-body ${className}`;

  if (html === null) {
    // `white-space: pre-wrap` (trong markdown.css) giữ nguyên xuống dòng của nguồn, nên nhịp
    // chờ này trông giống một bản nháp chứ không giống trang lỗi.
    return (
      <div className={classes} data-markdown-state="pending">
        {source}
      </div>
    );
  }

  return (
    <div
      className={classes}
      data-markdown-state="ready"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default Markdown;
