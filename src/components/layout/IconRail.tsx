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
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'

/** Nhãn tạm sau khi chạm sống bao lâu (ms) — "vài giây" của FR-E7. */
const TOUCH_LABEL_MS = 2000

export interface RailItem {
  key: string
  /** Nhãn tiếng Việt: vừa là tooltip, vừa là tên cho trình đọc màn hình. */
  label: string
  /** Nhận ReactNode để nơi dùng tự chọn icon (lucide-react) — rail không ràng buộc bộ icon. */
  icon: ReactNode
  badge?: number
}

export interface IconRailProps {
  items: RailItem[]
  /**
   * `null` là **trạng thái thật**, không phải lỗi: khung đầu đang ở *chế độ bài* (dải tab
   * FR-E3 của bài đang mở) nên **không icon nào được tô sáng** (FR-E7 v0.5). Tuyệt đối
   * không tự ép chọn một mục khi nhận null.
   */
  activeKey: string | null
  onSelect: (key: string) => void
}

export function IconRail({ items, activeKey, onSelect }: IconRailProps) {
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

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, key: string) => {
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
      aria-label="Điều hướng khu làm bài"
      data-testid="icon-rail"
      // 48px cố định (w-12) — FR-E1 tính phần còn lại cho hai khung dựa trên con số này.
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface-2 py-2"
    >
      <ul className="flex flex-col items-center gap-1">
        {items.map((item) => {
          const isActive = activeKey === item.key
          const showTip = visibleTipKey === item.key
          const tipId = `${tipIdBase}-${item.key}`
          const hasBadge = typeof item.badge === 'number' && item.badge > 0
          return (
            <li key={item.key} className="relative">
              <button
                type="button"
                // aria-label đè nội dung con, nên số badge phải nằm trong chính nhãn này
                // thì trình đọc màn hình mới đọc được.
                aria-label={hasBadge ? `${item.label} (${item.badge})` : item.label}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`rail-item-${item.key}`}
                className={`relative flex h-10 w-10 items-center justify-center  transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  isActive
                    ? 'bg-primary-soft text-primary'
                    : 'text-ink-5 hover:bg-surface-sel hover:text-ink-2'
                }`}
                onClick={() => onSelect(item.key)}
                onPointerDown={(e) => onPointerDown(e, item.key)}
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
                    className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-wa px-1 text-[10px] leading-4 font-semibold text-on-accent"
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>

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
                  className="pointer-events-none absolute top-1/2 left-full z-50 ml-2 -translate-y-1/2 border border-line bg-surface-sel px-2 py-1 font-mono text-[11px] whitespace-nowrap text-ink-1"
                >
                  {item.label}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default IconRail
