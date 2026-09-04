/**
 * Khung của CỘT BÊN — `SidePanel`, `SideColumn`, `SideLabel`.
 *
 * Tách khỏi `patterns.tsx` vì hai lý do, không phải để lách trần 250 dòng: cột bên là
 * một cụm dùng CHUNG (tám màn import đúng ba thứ này và không đụng tới RowGroup hay
 * Segments), và luật màu của nó — dải `--panel-head` chỉ nhận `--ink-3` — là thứ phải
 * đọc trọn một chỗ chứ không nằm lẫn giữa mười mẫu khác.
 *
 * `patterns.tsx` xuất lại ba tên này nên mọi chỗ gọi cũ không phải sửa, và
 * design-system/readme.md vẫn đúng khi nói chúng nằm trong "ngữ pháp bố cục dùng chung".
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Cột phải của các màn hai cột.
 *
 * Nền tụt một bậc xuống `--surface-3` và có đường kẻ trái — thiết kế phân tầng
 * bằng nền và đường kẻ, không bằng bóng đổ.
 */
/**
 * Khung của một vùng trong cột bên: viền + dải tiêu đề mang màu.
 *
 * Trước đây ba vùng của trang chủ (contest · log · BXH) chỉ là <section> trần trên
 * cùng một nền, phân cách bằng một đường kẻ 1px — đọc ra thành một dải chữ dài liền
 * mạch, không thấy đâu là ranh giới.
 *
 * Cách chữa là tăng DIỆN TÍCH màu, không phải tăng độ đậm: `--panel-head` sơn cả
 * dải tiêu đề (1.83:1 so với thân khung ở bản sáng, 1.81:1 ở bản tối), cộng khối
 * moss đặc 4×16px đầu dải. Khối đó là chữ ký của hệ (giống dấu sau chữ BCN) và nó
 * ĐẶC nên đọc được ở cả hai theme, không phụ thuộc dải đậm tới đâu.
 *
 * Dải đậm tới mức chỉ còn `--ink-3` đặt lên được: ink-4 đo ra 3.84:1 và ink-5 chỉ
 * 3.41:1 ở bản tối, tức dưới ngưỡng cho chữ mono 11px. Vì vậy chữ `meta` mép phải
 * cũng là ink-3, không phải ink-5 như mọi chú thích khác trong app.
 *
 * KHÔNG cho mỗi vùng một hue riêng: moss/clay/earth đã có nghĩa cố định là verdict
 * (AC/WA/TLE) và brass là leader — tô vùng "Log" màu clay thì nó đọc ra "lỗi".
 */
export function SidePanel({
  label,
  meta,
  tone = 'moss',
  flush = false,
  children,
}: {
  label: string
  /** Chữ nhỏ mép phải dải tiêu đề, ví dụ "cập nhật mỗi 5s". */
  meta?: ReactNode
  /**
   * Màu khối đầu dải. `earth` dành cho vùng contest ĐANG chạy — trên trang chủ,
   * earth vốn đã là màu của "đang diễn ra" (chấm sống + đồng hồ đếm ngược), nên đây
   * là màu mang nghĩa sẵn có, không phải tô cho vui.
   */
  tone?: 'moss' | 'earth'
  /** `true` = nội dung sát viền, cho danh sách tự có padding riêng (RowGroup). */
  flush?: boolean
  children: ReactNode
}) {
  return (
    <section className="border border-line bg-surface-2">
      <header className="flex items-center gap-2.5 border-b border-line bg-(--panel-head) px-3.5 py-2.5">
        <span aria-hidden className={cn('h-4 w-1 shrink-0', tone === 'earth' ? 'bg-earth' : 'bg-moss-fill')} />
        <h2 className="font-mono text-[11px] font-normal tracking-[0.14em] text-ink-3 uppercase">{label}</h2>
        {meta ? <span className="ml-auto font-mono text-[11px] whitespace-nowrap text-ink-3">{meta}</span> : null}
      </header>
      <div className={flush ? '' : 'px-3.5 py-3.5'}>{children}</div>
    </section>
  )
}

export function SideColumn({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <aside className={cn('flex flex-col gap-7 border-l border-line bg-surface-3 px-6 py-8', className)}>{children}</aside>
  )
}

/** Nhãn mục mono ALL-CAPS dùng trong cột phải (nơi không cần cả motif đường kẻ). */
export function SideLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3.5 font-mono text-[11px] font-normal tracking-[0.14em] text-(--label) uppercase">{children}</h2>
  )
}
