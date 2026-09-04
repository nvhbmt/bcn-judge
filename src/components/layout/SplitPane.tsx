/**
 * SplitPane — hai khung cạnh nhau, vạch chia dọc kéo được (FR-E1, FR-E2).
 *
 * Tự viết thay vì dùng thư viện (design.md ADR-3): FR-E1 ràng buộc chiều rộng tối thiểu
 * **theo pixel** (320px) trong khi `react-resizable-panels` & co. chỉ ràng buộc theo phần trăm,
 * nên đánh vật với ranh giới px/% còn đắt hơn ~150 dòng tự sở hữu.
 *
 * Một code path duy nhất cho chuột lẫn cảm ứng nhờ pointer events + `setPointerCapture`
 * (FR-E1 yêu cầu cả hai); `.split-handle` trong index.css đặt `touch-action: none` để iOS
 * không cuộn trang khi đang kéo.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Bề rộng vạch chia (px) — trừ ra khỏi phần chia được để phép kẹp tối thiểu là chính xác. */
export const DIVIDER_PX = 8

/** FR-E2: mỗi lần bấm phím mũi tên đổi 2%. */
const KEY_STEP = 0.02

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5
  return Math.min(Math.max(n, 0), 1)
}

/**
 * Kẹp tỉ lệ sao cho cả hai khung đều không nhỏ hơn ngưỡng pixel của mình (FR-E1: 320px).
 *
 * `total <= 0` nghĩa là chưa đo được layout (jsdom không có layout engine, hoặc lần render đầu
 * trước khi trình duyệt bố cục xong) — khi đó chỉ kẹp trong [0, 1] chứ không đoán bừa pixel.
 */
export function clampByPx(ratio: number, total: number, minStart: number, minEnd: number): number {
  if (!Number.isFinite(total) || total <= 0) return clamp01(ratio)
  const lo = minStart / total
  const hi = (total - minEnd - DIVIDER_PX) / total
  // Khung quá hẹp để thoả cả hai ngưỡng: chia đôi còn hơn nhảy giật về một biên.
  if (hi <= lo) return 0.5
  return Math.min(Math.max(clamp01(ratio), lo), hi)
}

function readRatio(storageKey: string, fallback: number): number {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw === null) return fallback
    const n = Number.parseFloat(raw)
    // Giá trị hỏng hoặc ngoài biên (người dùng sửa tay localStorage) thì quay về mặc định.
    return Number.isFinite(n) && n > 0 && n < 1 ? n : fallback
  } catch {
    return fallback // Safari private mode ném ngay khi đọc localStorage.
  }
}

/**
 * Tỉ lệ chia + ghi nhớ qua localStorage — FR-E1 "tỉ lệ được nhớ cho lần sau trên cùng trình duyệt".
 * Tách ra để `HSplit` (FR-E5) dùng lại nguyên vẹn, khỏi nhân đôi phần bền vững hoá.
 */
export function useSplitRatio(storageKey: string, defaultRatio: number) {
  // Khởi tạo lười: đọc trước lần paint đầu để không thấy khung nhảy từ 50/50 sang tỉ lệ đã lưu.
  const [ratio, setRatio] = useState(() => readRatio(storageKey, defaultRatio))
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, ratio.toFixed(4))
    } catch {
      /* Hết quota hoặc private mode: mất trí nhớ tỉ lệ không đáng để làm hỏng UI. */
    }
  }, [storageKey, ratio])
  return [ratio, setRatio] as const
}

export interface SplitPaneProps {
  left: ReactNode
  right: ReactNode
  /** Khoá localStorage giữ tỉ lệ; coi như cố định trong vòng đời component. */
  storageKey: string
  minPx?: number
  defaultRatio?: number
  /**
   * Khung đang thu gọn (FR-E2). State này do **cha** giữ vì nút thu gọn/mở lại nằm ở thanh
   * công cụ của cha, và cha còn cần biết để đổi nhãn nút — SplitPane không sở hữu nó.
   */
  collapsed?: 'left' | 'right' | null
}

export function SplitPane({
  left,
  right,
  storageKey,
  minPx = 320,
  defaultRatio = 0.5,
  collapsed = null,
}: SplitPaneProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useSplitRatio(storageKey, defaultRatio)
  const [dragging, setDragging] = useState(false)

  /** Đo lại rect ngay lúc kéo thay vì cache: khỏi cần ResizeObserver (jsdom cũng không có). */
  const widthOf = useCallback(() => rootRef.current?.getBoundingClientRect().width ?? 0, [])

  const applyClientX = useCallback(
    (clientX: number) => {
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0) return // chưa có layout: kéo không có nghĩa gì
      // Tâm vạch chia bám con trỏ, nên bề rộng khung trái là x trừ nửa vạch.
      const x = clientX - rect.left - DIVIDER_PX / 2
      setRatio(clampByPx(x / rect.width, rect.width, minPx, minPx))
    },
    [minPx, setRatio],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (collapsed) return
    // Bắt con trỏ để pointermove/up vẫn về đúng vạch chia dù trỏ trượt qua iframe/editor.
    // jsdom chưa cài setPointerCapture nên phải kiểm tra trước khi gọi.
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* Trình duyệt cũ không hỗ trợ: kéo vẫn chạy, chỉ kém bền khi trỏ ra ngoài. */
    }
    e.preventDefault() // chặn chọn văn bản / cuộn cảm ứng ngay từ nhịp đầu
    setDragging(true)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    applyClientX(e.clientX)
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {
      /* đã tự nhả rồi */
    }
    setDragging(false)
  }

  // NFR-6: vạch chia phải chỉnh được chỉ bằng bàn phím.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (collapsed) return
    const total = widthOf()
    const clamp = (r: number) => clampByPx(r, total, minPx, minPx)
    let next: number | null = null
    if (e.key === 'ArrowLeft') next = clamp(ratio - KEY_STEP)
    else if (e.key === 'ArrowRight') next = clamp(ratio + KEY_STEP)
    else if (e.key === 'Home') next = clamp(0) // sát ngưỡng tối thiểu của khung trái
    else if (e.key === 'End') next = clamp(1)
    if (next === null) return
    e.preventDefault() // Home/End không được cuộn khung nội dung
    setRatio(next)
  }

  const percent = Math.round(ratio * 100)
  const template =
    collapsed === 'left'
      ? `0px ${DIVIDER_PX}px minmax(0, 1fr)`
      : collapsed === 'right'
        ? `minmax(0, 1fr) ${DIVIDER_PX}px 0px`
        : // minmax() để khi cửa sổ co lại, hai khung tự giữ ngưỡng 320px mà không cần đo lại.
          `minmax(${minPx}px, ${(ratio * 100).toFixed(4)}%) ${DIVIDER_PX}px minmax(${minPx}px, 1fr)`

  return (
    <div
      ref={rootRef}
      data-testid="split-pane"
      data-ratio={ratio.toFixed(4)}
      className="grid h-full min-h-0 w-full"
      style={{ gridTemplateColumns: template }}
    >
      <div
        data-testid="split-left"
        className="min-w-0 overflow-hidden"
        // Thu gọn = ẩn bằng CSS, **không** unmount: nội dung khung phải sống qua thu gọn/mở lại.
        aria-hidden={collapsed === 'left' || undefined}
        inert={collapsed === 'left'}
      >
        {left}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Kéo để đổi tỉ lệ hai khung"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${percent}%`}
        aria-disabled={collapsed ? true : undefined}
        tabIndex={collapsed ? -1 : 0}
        data-testid="split-divider"
        data-dragging={dragging ? 'true' : undefined}
        className={cn(
          'split-handle relative bg-line outline-offset-0 transition-colors hover:bg-primary/50 focus-visible:bg-primary/60 focus-visible:outline-2 focus-visible:outline-primary',
          dragging && 'bg-primary/60',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={() => setDragging(false)}
        onDoubleClick={() => setRatio(defaultRatio)} // FR-E2: nhấp đúp về tỉ lệ mặc định
        onKeyDown={onKeyDown}
      >
        {/* Vùng chạm nới rộng ra hai bên: 8px là quá mảnh cho ngón tay (FR-E1 cảm ứng). */}
        <span aria-hidden="true" className="absolute inset-y-0" style={{ left: -6, right: -6 }} />
      </div>

      <div
        data-testid="split-right"
        className="min-w-0 overflow-hidden"
        aria-hidden={collapsed === 'right' || undefined}
        inert={collapsed === 'right'}
      >
        {right}
      </div>
    </div>
  )
}

export default SplitPane
