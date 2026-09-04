/**
 * IconRail — thanh icon cố định 48px bên trái khu làm bài (FR-E7, bản v0.4+).
 *
 * **Chỉ có icon + tooltip**: không có trạng thái mở rộng, không Drawer, kể cả dưới 900px
 * (FR-E9: "thanh icon giữ nguyên — đã đủ hẹp"). Mô hình sidebar 260px thu gọn được của v0.3
 * đã bị v0.4 loại bỏ, đừng thêm lại.
 *
 * Ba đường hiện nhãn theo đúng FR-E7:
 *  - rê chuột  → tooltip
 *  - focus bằng Tab → tooltip (bàn phím không rê chuột được — NFR-6)
 *  - chạm (cảm ứng) → vừa chuyển mục vừa hiện nhãn tạm vài giây, vì thiết bị cảm ứng
 *    không có trạng thái hover để đọc nhãn trước khi bấm.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ComponentPropsWithoutRef, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

/** Nhãn tạm sau khi chạm sống bao lâu (ms) — "vài giây" của FR-E7. */
const TOUCH_LABEL_MS = 2000

export interface RailItem {
  key: string
  /** Nhãn tiếng Việt: vừa là tooltip, vừa là tên cho trình đọc màn hình. */
  label: string
  /** Nhận ReactNode để nơi dùng tự chọn icon (lucide-react) — rail không ràng buộc bộ icon. */
  icon: ReactNode
  badge?: number
  /**
   * Đẩy mục này xuống ĐÁY thanh, tách khỏi nhóm trên.
   *
   * Dành cho thứ không cùng họ với các mục điều hướng nội dung — "Trợ giúp" nói về
   * chính giao diện, không phải về bài đang làm. Xếp lẫn vào giữa thì nó trông như
   * một panel nội dung nữa.
   */
  atBottom?: boolean
  /**
   * Có URL riêng thì mục này là LIÊN KẾT thật (`<a>`), không phải nút.
   *
   * Màn sửa khoá dùng nhánh đó: mỗi phần có URL riêng nên tải lại trang vẫn ở đúng
   * chỗ, gửi link cho đồng nghiệp thì họ mở ra đúng chỗ mình đang nói, và chuột giữa
   * mở được tab mới. Khu làm bài thì ngược lại — panel không có URL nên nó là nút.
   */
  href?: string
}

export interface IconRailProps {
  items: RailItem[]
  /**
   * `null` là **trạng thái thật**, không phải lỗi: khung đầu đang ở *chế độ bài* (dải tab
   * FR-E3 của bài đang mở) nên **không icon nào được tô sáng** (FR-E7 v0.5). Tuyệt đối
   * không tự ép chọn một mục khi nhận null.
   */
  activeKey: string | null
  /** Chỉ gọi cho mục KHÔNG có `href`; mục có href thì router lo việc điều hướng. */
  onSelect: (key: string) => void
  /** Nhãn trợ năng của cả thanh — mỗi màn dùng nó cho một việc khác nhau. */
  ariaLabel?: string
}

/**
 * Một ô của thanh: `<Link>` khi mục có URL riêng, `<button>` khi không.
 *
 * Tách ra để phần tooltip/badge/trạng thái chỉ có MỘT bản — nếu chép thành hai thanh
 * riêng thì phần xử lý chạm (nhãn tự tắt sau 2s) sẽ trôi lệch giữa hai chỗ, mà đó
 * đúng là đoạn khó nhất ở đây.
 */
function Item({
  item,
  onSelect,
  className,
  children,
  ...rest
}: {
  item: RailItem
  onSelect: () => void
  className: string
  children: ReactNode
} & Omit<ComponentPropsWithoutRef<'button'>, 'onSelect' | 'className' | 'children'>) {
  if (item.href !== undefined) {
    const { type: _type, ...linkProps } = rest as Record<string, unknown>
    return (
      <Link to={item.href} className={className} {...linkProps}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" className={className} onClick={onSelect} {...rest}>
      {children}
    </button>
  )
}

export function IconRail({ items, activeKey, onSelect, ariaLabel = 'Điều hướng khu làm bài' }: IconRailProps) {
  const tipIdBase = useId()
  // Tách hover/focus khỏi chạm: nhãn do chạm phải tự tắt theo giờ, còn hover tắt theo con trỏ.
  const [pointedKey, setPointedKey] = useState<string | null>(null)
  const [touchedKey, setTouchedKey] = useState<string | null>(null)
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTouchTimer = useCallback(() => {
    if (touchTimer.current !== null) {
      clearTimeout(touchTimer.current)
      touchTimer.current = null
    }
  }, [])

  useEffect(() => clearTouchTimer, [clearTouchTimer])

  const onPointerDown = (e: ReactPointerEvent<Element>, key: string) => {
    if (e.pointerType !== 'touch') return
    clearTouchTimer()
    // Chạm xong, di động còn bắn tiếp mouseenter/focus giả lập; nhường hẳn quyền hiện nhãn cho
    // đường "chạm" (có hẹn giờ) để nhãn không dính lại vĩnh viễn sau khi nhấc ngón tay.
    setPointedKey(null)
    setTouchedKey(key)
    touchTimer.current = setTimeout(() => {
      setTouchedKey(null)
      touchTimer.current = null
    }, TOUCH_LABEL_MS)
  }

  /** Bỏ qua hover/focus giả lập sinh ra ngay sau một cú chạm (xem `onPointerDown`). */
  const showByPointer = (key: string) => {
    if (touchTimer.current !== null) return
    setPointedKey(key)
  }

  const visibleTipKey = touchedKey ?? pointedKey

  return (
    <nav
      aria-label={ariaLabel}
      data-testid="icon-rail"
      // 48px cố định (w-12) — FR-E1 tính phần còn lại cho hai khung dựa trên con số này.
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface-2 py-2"
    >
      {[false, true].map((bottom) => {
        const group = items.filter((i) => Boolean(i.atBottom) === bottom)
        if (group.length === 0) return null
        return (
      <ul key={String(bottom)} className={cn('flex flex-col items-center gap-1', bottom && 'mt-auto')}>
        {group.map((item) => {
          const isActive = activeKey === item.key
          const showTip = visibleTipKey === item.key
          const tipId = `${tipIdBase}-${item.key}`
          const hasBadge = typeof item.badge === 'number' && item.badge > 0
          return (
            <li key={item.key} className="relative">
              <Item
                item={item}
                // aria-label đè nội dung con, nên số badge phải nằm trong chính nhãn này
                // thì trình đọc màn hình mới đọc được.
                aria-label={hasBadge ? `${item.label} (${item.badge})` : item.label}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`rail-item-${item.key}`}
                onSelect={() => onSelect(item.key)}
                // Kích thước 56×44 và vạch TRONG 2px bên trái theo bản vẽ (màn 04).
                // `shadow-[inset_…]` ở đây không phải bóng đổ — hệ thiết kế không có
                // bóng — mà là cách CSS duy nhất vẽ một vạch nằm BÊN TRONG mép trái mà
                // không đẩy nội dung sang phải như `border-l` sẽ làm.
                //
                // Nền mục ĐANG mở là `--primary-soft`, nền lúc rê chuột mới là
                // `--surface-sel`. Ở bản tối hai token trùng giá trị nên khác biệt này
                // vô hình; ở bản sáng thì primary-soft mang sắc moss còn surface-sel là
                // be trung tính — để nguyên surface-sel là mục đang mở mất hẳn màu.
                className={cn(
                  'relative flex h-11 w-14 items-center justify-center transition-colors duration-120 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss',
                  isActive ? 'bg-primary-soft text-moss shadow-[inset_2px_0_0_var(--moss)]' : 'text-ink-5 hover:bg-surface-sel hover:text-ink-2',
                )}
                onPointerDown={(e: ReactPointerEvent) => onPointerDown(e, item.key)}
                onMouseEnter={() => showByPointer(item.key)}
                onMouseLeave={() => setPointedKey((k) => (k === item.key ? null : k))}
                onFocus={() => showByPointer(item.key)}
                onBlur={() => setPointedKey((k) => (k === item.key ? null : k))}
              >
                <span aria-hidden="true" className="grid place-items-center">
                  {item.icon}
                </span>
                {hasBadge ? (
                  <span
                    aria-hidden="true"
                    data-testid={`rail-badge-${item.key}`}
                    className="absolute -top-0.5 -right-0.5 min-w-4 bg-wa px-1 text-[10px] leading-4 font-semibold text-on-accent"
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Item>

              {/*
                Tooltip cố ý **không** nối bằng aria-describedby: nội dung nó trùng hệt aria-label
                của nút, nối vào là trình đọc màn hình đọc hai lần cùng một chữ. Nó là phương tiện
                nhìn/chạm; phần trợ năng đã do aria-label + title đảm nhiệm.
              */}
              {showTip ? (
                <span
                  role="tooltip"
                  id={tipId}
                  data-testid="rail-tooltip"
                  className="pointer-events-none absolute top-1/2 left-full z-50 ml-2 -translate-y-1/2 border border-line bg-surface-sel px-2 py-1 font-mono text-[13px] whitespace-nowrap text-ink-1"
                >
                  {item.label}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
        )
      })}
    </nav>
  )
}

export default IconRail
