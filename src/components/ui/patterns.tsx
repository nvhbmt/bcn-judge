/**
 * Những mẫu LẶP LẠI trên cả 8 màn của bản thiết kế v2.
 *
 * Vì sao tách riêng khỏi `ui/index.tsx`: các mẫu này không phải "component" theo
 * nghĩa nút hay badge — chúng là ngữ pháp bố cục của hệ thiết kế. Trước đây mỗi
 * trang tự dựng lại bằng class rời, nên mỗi trang lệch một kiểu: chỗ thì thẻ có
 * viền riêng cách nhau 8px, chỗ thì bảng, chỗ thì danh sách trơn. Thiết kế chỉ có
 * MỘT cách trình bày danh sách, và nó nằm ở đây.
 *
 * Xem design-system/readme.md, mục VISUAL FOUNDATIONS.
 */
import type { ReactNode } from 'react'

/**
 * Nhóm dòng "khe 1px" — cách trình bày danh sách DUY NHẤT của hệ thiết kế.
 *
 * Không phải thẻ rời: các dòng dính liền nhau, ngăn nhau bằng khe 1px để lộ nền
 * `--line` bên dưới. Readme gọi đây là "khe 1px (gap:1px trên nền --line), không
 * phải thẻ rời" — nó làm bảng trông như một khối liền chứ không như một chồng card.
 */
export function RowGroup({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-px border border-line bg-line ${className}`}>{children}</div>
}

/** Màu vạch trong bên trái của dòng đang chọn / đang cần chú ý. */
export type RowAccent = 'moss' | 'earth' | 'clay' | null

const ACCENT_BORDER: Record<Exclude<RowAccent, null>, string> = {
  moss: 'border-l-2 border-l-moss',
  earth: 'border-l-2 border-l-earth',
  clay: 'border-l-2 border-l-clay',
}

/**
 * Một dòng trong `RowGroup`.
 *
 * `accent` làm dòng nổi lên bằng nền đậm hơn một bậc + vạch TRONG 2px bên trái.
 * Readme nói rõ đây là "một vạch, không phải bóng" — cả hệ không có bóng đổ.
 */
export function Row({
  children,
  accent = null,
  interactive = false,
  cols,
  className = '',
}: {
  children: ReactNode
  accent?: RowAccent
  interactive?: boolean
  /**
   * `grid-template-columns` khi dòng cần cột THẲNG HÀNG với một hàng tiêu đề (bảng
   * bài tập của mentor, chẳng hạn). Không đặt thì dòng dùng flex như mặc định — phần
   * lớn danh sách không có hàng tiêu đề nên không cần khoá bề rộng cột.
   */
  cols?: string
  className?: string
}) {
  return (
    <div
      style={cols ? { gridTemplateColumns: cols } : undefined}
      className={`${cols ? 'grid gap-3.5' : 'flex gap-3.5'} items-center px-4 py-3 ${
        accent ? `bg-surface-sel ${ACCENT_BORDER[accent]}` : 'bg-surface-2'
      } ${interactive ? 'transition-colors duration-[120ms] ease-linear hover:bg-surface-sel' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * Hàng tiêu đề cột đứng TRÊN một `RowGroup`, dùng chung `cols` với các dòng bên dưới
 * để mọi cột thẳng hàng. Mono 10px ALL-CAPS theo bản vẽ — nhỏ hơn nhãn mục một bậc,
 * vì nó là chú thích cho bảng chứ không phải một đầu mục.
 */
export function RowHead({ cols, children }: { cols: string; children: ReactNode }) {
  return (
    <div
      style={{ gridTemplateColumns: cols }}
      className="grid gap-3.5 border-b border-line px-4 pb-2 font-mono text-[10px] tracking-[0.06em] text-ink-5 uppercase"
    >
      {children}
    </div>
  )
}

/**
 * Thanh tiến độ dạng Ô RỜI, không phải một vạch liền.
 *
 * 18 ô cố định với khe 2px — con số 18 lấy thẳng từ thiết kế và KHÔNG phải là số
 * bài: khoá 22 bài vẫn vẽ 18 ô. Nó là thước tỉ lệ, đọc bằng mắt chứ không đếm.
 */
export function Segments({
  percent,
  height = 6,
  count = 18,
}: {
  percent: number
  height?: number
  count?: number
}) {
  const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * count)
  return (
    <span aria-hidden className="flex gap-0.5">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`flex-1 ${i < filled ? 'bg-moss-fill' : 'bg-line-strong'}`}
          style={{ height: `${height}px` }}
        />
      ))}
    </span>
  )
}

/**
 * Dải số liệu: nhãn mono nhỏ ở trên, số mono lớn ở dưới, các ô ngăn nhau bằng khe
 * 1px. Dùng ở màn contest ("Điểm của bạn"), mentor và quản trị.
 */
export function StatStrip({ items }: { items: { label: string; value: ReactNode; tone?: 'moss' | 'earth' | 'clay' }[] }) {
  return (
    <div className="grid gap-px border border-line bg-line" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <div key={it.label} className="bg-surface-2 px-4 py-3">
          <div className="font-mono text-[11px] tracking-[0.14em] text-ink-6 uppercase">{it.label}</div>
          <div
            className={`num mt-1.5 font-mono text-[22px] font-semibold ${
              it.tone === 'moss' ? 'text-moss' : it.tone === 'earth' ? 'text-earth' : it.tone === 'clay' ? 'text-clay' : 'text-ink-1'
            }`}
          >
            {it.value}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Lấy chữ cái đầu của `count` từ cuối — "Trần Quốc Bảo" → "QB", đúng cách gọi tên người Việt. */
export function initials(name: string, count = 2): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(-count)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

/** Ô vuông chữ cái đầu. Vuông chứ không tròn — bo góc 0 là luật của hệ. */
export function Avatar({ name, size = 26, chars = 2 }: { name: string; size?: number; chars?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center bg-line font-mono font-semibold text-moss"
      style={{ width: size, height: size, fontSize: chars > 1 ? 11 : 12 }}
    >
      {initials(name, chars)}
    </span>
  )
}

/** Vạch ngăn giữa hai khối trong cột phải. */
export function Divider() {
  return <div aria-hidden className="h-px bg-line" />
}

/**
 * Cột phải của các màn hai cột.
 *
 * Nền tụt một bậc xuống `--surface-3` và có đường kẻ trái — thiết kế phân tầng
 * bằng nền và đường kẻ, không bằng bóng đổ.
 */
export function SideColumn({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <aside className={`flex flex-col gap-7 border-l border-line bg-surface-3 px-6 py-8 ${className}`}>{children}</aside>
  )
}

/** Nhãn mục mono ALL-CAPS dùng trong cột phải (nơi không cần cả motif đường kẻ). */
export function SideLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3.5 font-mono text-[11px] font-normal tracking-[0.14em] text-ink-6 uppercase">{children}</h2>
  )
}
