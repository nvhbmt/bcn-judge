/**
 * HSplit — cùng ý tưởng với `SplitPane` nhưng vạch chia **ngang**: bảng điều khiển
 * (Chạy thử / Kết quả) kéo cao thấp được dưới editor (FR-E5).
 *
 * Dùng chung `useSplitRatio` + `clampByPx` của SplitPane nên phần bền vững hoá và phép kẹp
 * pixel chỉ tồn tại một bản; ngưỡng tối thiểu ở đây bất đối xứng (editor cần nhiều chỗ hơn
 * console) nên hai tham số min tách riêng chứ không dùng chung một `minPx`.
 */
import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { DIVIDER_PX, clampByPx, useSplitRatio } from './SplitPane'
import { cn } from '@/lib/cn'

const KEY_STEP = 0.02

export interface HSplitProps {
  top: ReactNode
  bottom: ReactNode
  storageKey: string
  minTopPx?: number
  minBottomPx?: number
  defaultRatio?: number
  /** Thu gọn một nửa (thường là console) — nút bấm do cha render, giống FR-E2. */
  collapsed?: 'top' | 'bottom' | null
}

export function HSplit({
  top,
  bottom,
  storageKey,
  minTopPx = 160,
  minBottomPx = 96,
  defaultRatio = 0.65,
  collapsed = null,
}: HSplitProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useSplitRatio(storageKey, defaultRatio)
  const [dragging, setDragging] = useState(false)

  const heightOf = useCallback(() => rootRef.current?.getBoundingClientRect().height ?? 0, [])

  const applyClientY = useCallback(
    (clientY: number) => {
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.height <= 0) return
      const y = clientY - rect.top - DIVIDER_PX / 2
      setRatio(clampByPx(y / rect.height, rect.height, minTopPx, minBottomPx))
    },
    [minTopPx, minBottomPx, setRatio],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (collapsed) return
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* jsdom & trình duyệt cũ: kéo vẫn chạy, chỉ kém bền */
    }
    e.preventDefault()
    setDragging(true)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    applyClientY(e.clientY)
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {
      /* đã tự nhả */
    }
    setDragging(false)
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (collapsed) return
    const total = heightOf()
    const clamp = (r: number) => clampByPx(r, total, minTopPx, minBottomPx)
    let next: number | null = null
    if (e.key === 'ArrowUp') next = clamp(ratio - KEY_STEP)
    else if (e.key === 'ArrowDown') next = clamp(ratio + KEY_STEP)
    else if (e.key === 'Home') next = clamp(0)
    else if (e.key === 'End') next = clamp(1)
    if (next === null) return
    e.preventDefault()
    setRatio(next)
  }

  const percent = Math.round(ratio * 100)
  const template =
    collapsed === 'top'
      ? `0px ${DIVIDER_PX}px minmax(0, 1fr)`
      : collapsed === 'bottom'
        ? `minmax(0, 1fr) ${DIVIDER_PX}px 0px`
        : `minmax(${minTopPx}px, ${(ratio * 100).toFixed(4)}%) ${DIVIDER_PX}px minmax(${minBottomPx}px, 1fr)`

  return (
    <div
      ref={rootRef}
      data-testid="hsplit"
      data-ratio={ratio.toFixed(4)}
      className="grid h-full min-h-0 w-full"
      style={{ gridTemplateRows: template }}
    >
      <div
        data-testid="hsplit-top"
        className="min-h-0 overflow-hidden"
        aria-hidden={collapsed === 'top' || undefined}
        inert={collapsed === 'top'}
      >
        {top}
      </div>

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Kéo để đổi chiều cao bảng điều khiển"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${percent}%`}
        aria-disabled={collapsed ? true : undefined}
        tabIndex={collapsed ? -1 : 0}
        data-testid="hsplit-divider"
        data-dragging={dragging ? 'true' : undefined}
        className={cn(
          'split-handle-h relative bg-line transition-colors hover:bg-primary/50 focus-visible:bg-primary/60 focus-visible:outline-2 focus-visible:outline-primary',
          dragging && 'bg-primary/60',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={() => setDragging(false)}
        onDoubleClick={() => setRatio(defaultRatio)}
        onKeyDown={onKeyDown}
      >
        <span aria-hidden="true" className="absolute inset-x-0" style={{ top: -6, bottom: -6 }} />
      </div>

      <div
        data-testid="hsplit-bottom"
        className="min-h-0 overflow-hidden"
        aria-hidden={collapsed === 'bottom' || undefined}
        inert={collapsed === 'bottom'}
      >
        {bottom}
      </div>
    </div>
  )
}

export default HSplit
