/**
 * Workspace — bố cục ba vùng của màn hình làm bài (FR-E1):
 * `IconRail (48px) | SplitPane(khung nội dung | khung code)`.
 *
 * Dưới 900px (FR-E9) thanh icon **giữ nguyên** (đã đủ hẹp, không biến thành Drawer) còn hai
 * khung đổi thành hai tab *Nội dung / Code*; nhãn tab Nội dung đổi theo mục đang hiển thị
 * (Đề bài / Giáo trình / Bảng xếp hạng / Trợ giúp / Mô tả) — cha truyền qua `contentLabel`.
 *
 * Hai tab **không** render có điều kiện mà ẩn bằng thuộc tính `hidden`: FR-E9 đòi "mọi chức năng
 * vẫn dùng được" và US-3 đòi code đang gõ không mất, nên editor phải giữ nguyên mounted khi
 * người dùng nhảy qua tab Nội dung.
 *
 * Lưu ý: lật qua lại giữa hẹp và rộng thì cây con có đổi chỗ (split ↔ tabs) nên editor sẽ
 * remount — đúng như design.md §6 dự tính: nội dung code sống trong store nháp (FR-E6),
 * không sống trong DOM.
 */
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { SplitPane } from './SplitPane'
import { cn } from '@/lib/cn'

export const NARROW_QUERY = '(max-width: 899px)'

/** Theo dõi media query; an toàn khi `matchMedia` không tồn tại (jsdom, SSR). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange() // query có thể đã đổi giữa lần render đầu và lúc effect chạy
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    }
    // Safari < 14 chỉ có addListener.
    mql.addListener(onChange)
    return () => mql.removeListener(onChange)
  }, [query])

  return matches
}

type TabKey = 'content' | 'editor'
const TAB_ORDER: TabKey[] = ['content', 'editor']

export interface WorkspaceProps {
  rail: ReactNode
  content: ReactNode
  /**
   * Khung code. BỎ TRỐNG với mục không có gì để gõ — bài đọc của giáo trình chẳng
   * hạn: ở đó một editor rỗng cạnh vạch chia kéo được chỉ tổ mời người ta gõ vào một
   * chỗ không nộp đi đâu được.
   */
  editor?: ReactNode
  /** Nhãn mục đang hiển thị ở khung nội dung — dùng làm nhãn tab Nội dung khi màn hình hẹp. */
  contentLabel: string
  storageKey: string
  /** Chuyển tiếp cho SplitPane (FR-E2); vô nghĩa ở chế độ tab nên bị bỏ qua khi hẹp. */
  collapsed?: 'left' | 'right' | null
}

export function Workspace({ rail, content, editor, contentLabel, storageKey, collapsed = null }: WorkspaceProps) {
  const narrow = useMediaQuery(NARROW_QUERY)
  const [tab, setTab] = useState<TabKey>('content')
  const idBase = useId()
  const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({ content: null, editor: null })

  /*
   * FR-E9 "bấm icon khi đang ở tab Code chuyển về tab Nội dung" — hai lớp, cố ý:
   *  1. Bắt click ở giai đoạn capture trên bọc ngoài của rail. Đây là lớp chính vì nó đúng cả
   *     khi người dùng bấm lại đúng mục đang mở (nhãn không đổi nhưng vẫn phải nhảy về tab).
   *     Không cần cha nối thêm callback nào.
   *  2. Nhãn `contentLabel` đổi cũng kéo về tab Nội dung — bắt được cả trường hợp mục bị đổi từ
   *     nơi khác (chọn bài trong Giáo trình, mở bài từ URL) chứ không riêng cú bấm trên rail.
   */
  const handleRailClickCapture = () => {
    if (narrow) setTab('content')
  }

  const prevLabel = useRef(contentLabel)
  useEffect(() => {
    if (prevLabel.current === contentLabel) return
    prevLabel.current = contentLabel
    if (narrow) setTab('content')
  }, [contentLabel, narrow])

  const onTabKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = TAB_ORDER.indexOf(tab)
    let next: TabKey | undefined
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') next = TAB_ORDER[(i + 1) % TAB_ORDER.length]
    else if (e.key === 'Home') next = TAB_ORDER[0]
    else if (e.key === 'End') next = TAB_ORDER[TAB_ORDER.length - 1]
    if (!next) return
    e.preventDefault()
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  const tabId = (k: TabKey) => `${idBase}-tab-${k}`
  const panelId = (k: TabKey) => `${idBase}-panel-${k}`

  const tabButton = (k: TabKey, children: ReactNode, accessibleName?: string) => (
    <button
      type="button"
      role="tab"
      id={tabId(k)}
      // Tên cố định của tab theo FR-E9 ("Nội dung") + mục đang mở; phần nhìn thấy chỉ có mục
      // đang mở cho đỡ chật. Đặt bằng aria-label thay vì span sr-only để tên ghép ra ổn định.
      aria-label={accessibleName}
      ref={(el) => {
        tabRefs.current[k] = el
      }}
      aria-selected={tab === k}
      aria-controls={panelId(k)}
      // Roving tabindex: Tab đưa vào đúng tab đang chọn, mũi tên đi giữa hai tab (NFR-6).
      tabIndex={tab === k ? 0 : -1}
      data-testid={`workspace-tab-${k}`}
      className={cn(
        'flex-1 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
        tab === k ? 'border-primary text-primary' : 'border-transparent text-ink-5 hover:text-ink-2',
      )}
      onClick={() => setTab(k)}
    >
      {children}
    </button>
  )

  const panel = (k: TabKey, children: ReactNode) => (
    <div
      role="tabpanel"
      id={panelId(k)}
      aria-labelledby={tabId(k)}
      hidden={tab !== k}
      data-testid={`workspace-panel-${k}`}
      // `hidden` chứ không tháo khỏi cây: FR-E9 — code đang gõ không được mất khi đổi tab.
      className="h-full min-h-0"
    >
      {children}
    </div>
  )

  const railNode = (
    // `contents` để bọc ngoài không chen thêm hộp nào vào flex — rail tự giữ kích
    // thước của mình (56px dọc khi rộng, thanh ngang khi hẹp).
    <div className="contents" onClickCapture={handleRailClickCapture}>
      {rail}
    </div>
  )

  const mainNode =
    editor === undefined ? (
      // Không có khung code: nội dung chiếm hết phần còn lại, ở cả hai cỡ màn hình.
      // Không dựng tablist một tab, cũng không dựng SplitPane một bên — cả hai đều là
      // bộ điều khiển không điều khiển được gì.
      <div className="min-w-0 flex-1">{content}</div>
    ) : narrow ? (
        <div className="flex min-w-0 flex-1 flex-col" data-testid="workspace-tabs">
          <div
            role="tablist"
            aria-label="Khung làm việc"
            aria-orientation="horizontal"
            className="flex shrink-0 border-b border-line"
            onKeyDown={onTabKeyDown}
          >
            {tabButton('content', contentLabel, `Nội dung: ${contentLabel}`)}
            {tabButton('editor', 'Code')}
          </div>
          <div className="min-h-0 flex-1">
            {panel('content', content)}
            {panel('editor', editor)}
          </div>
        </div>
      ) : (
      <div className="min-w-0 flex-1">
        {/* 0.474 chứ không phải 0.5: bản vẽ chia `56px | 656px | 1fr` trên khung 1440,
            tức khung nội dung chiếm 656/1384 chiều ngang còn lại. Lệch lưới cố ý —
            khung code cần rộng hơn khung đề. Người dùng kéo được, và nhấp đúp vào
            vạch chia đưa về đúng tỉ lệ này (FR-E2). */}
        <SplitPane
          left={content}
          right={editor}
          storageKey={storageKey}
          defaultRatio={656 / 1384}
          collapsed={collapsed}
        />
      </div>
    )

  // Rộng: rail DỌC bên trái. Hẹp: xếp dọc và rail xuống ĐÁY — thứ tự JSX đảo hẳn thay
  // vì dùng CSS `order`, vì rail là flex item qua `display:contents` nên không nhận
  // được `order` từ một lớp bọc.
  // `pb-14` khi hẹp = đúng chiều cao thanh rail cố định ở đáy (h-14). Rail `fixed`
  // đã ra khỏi luồng nên không tự đẩy nội dung lên; thiếu padding này thì dòng cuối
  // của khung code / danh sách nằm khuất sau thanh, không cuộn tới được.
  return (
    <div
      className={cn('flex h-full min-h-0 w-full', narrow && 'flex-col pb-14')}
      data-testid="workspace"
    >
      {narrow ? (
        <>
          {mainNode}
          {railNode}
        </>
      ) : (
        <>
          {railNode}
          {mainNode}
        </>
      )}
    </div>
  )
}

export default Workspace
