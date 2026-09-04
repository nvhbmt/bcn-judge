/**
 * Menu tài khoản ở góc phải thanh trên.
 *
 * Trước đây ba việc của tài khoản nằm ở ba chỗ khác nhau: đổi theme và đăng xuất là hai
 * icon trần cạnh nhau trên thanh (đoán nghĩa bằng hình), còn đổi mật khẩu thì KHÔNG có
 * lối vào nào — trang `/doi-mat-khau` chỉ tồn tại trong nhánh bắt đổi lần đầu, nên ai
 * đã đổi rồi thì vĩnh viễn không tự đổi lại được, dù API `/auth/change-password` vẫn
 * nhận. Gom cả ba vào một chỗ có tên chữ hẳn hoi.
 *
 * Đổi theme KHÔNG đóng menu: nó là thứ người ta bật lên xem thử rồi đổi lại ngay, mà
 * đóng menu mỗi lần bấm thì muốn so hai bản phải mở lại từ đầu.
 *
 * Hệ thiết kế không có bóng đổ (xem IconRail), nên tấm menu tách khỏi nền bằng viền
 * đậm + mặt phẳng riêng, không phải bằng shadow.
 */
import { ChevronDown, KeyRound, LogOut, Moon, Sun, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/patterns'
import { currentTheme, toggleTheme, type Theme } from '@/lib/theme'
import { useAuth } from '@/stores/auth'
import { cn } from '@/lib/cn'

export function UserMenu() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => currentTheme())
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const dong = (traLaiTieuDiem = true) => {
    setOpen(false)
    if (traLaiTieuDiem) triggerRef.current?.focus()
  }

  // Bấm ra ngoài hoặc Esc thì đóng. `pointerdown` chứ không `click`: bấm vào một nút
  // khác trên thanh thì menu phải biến mất TRƯỚC khi nút đó chạy, không phải sau.
  useEffect(() => {
    if (!open) return
    const ngoai = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const phim = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dong()
    }
    document.addEventListener('pointerdown', ngoai)
    document.addEventListener('keydown', phim)
    return () => {
      document.removeEventListener('pointerdown', ngoai)
      document.removeEventListener('keydown', phim)
    }
  }, [open])

  // Mở ra là con trỏ bàn phím đã nằm sẵn trong menu — không thì người đi bằng Tab phải
  // dò tiếp qua phần còn lại của thanh mới tới được mục đầu tiên.
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [open])

  if (!me) return null

  const diChuyen = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    const buoc = e.key === 'ArrowDown' ? 1 : -1
    items[(i + buoc + items.length) % items.length]?.focus()
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={cn(
          'flex items-center gap-2 border px-1.5 py-1 transition-colors duration-120 ease-linear',
          open ? 'border-line bg-surface-code' : 'border-transparent hover:border-line hover:bg-surface-code',
        )}
      >
        <Avatar name={me.displayName} chars={1} src={me.avatarUrl} />
        <span className="hidden max-w-40 truncate font-mono text-[13px] text-ink-2 sm:inline">
          {me.displayName}
        </span>
        <ChevronDown size={13} className={cn('text-ink-5', open && 'rotate-180')} aria-hidden />
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Tài khoản"
          onKeyDown={diChuyen}
          className="absolute top-[calc(100%+6px)] right-0 z-50 w-64 border border-line-strong bg-surface-2"
        >
          {/* Ai đang đăng nhập — đọc được cả khi tên bị cắt ngắn ở nút. */}
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate font-mono text-[13px] text-ink-1">{me.displayName}</p>
            <p className="truncate font-mono text-[12px] text-ink-5">{me.email}</p>
          </div>

          <MenuItem
            icon={<UserRound size={14} />}
            onClick={() => {
              dong(false)
              navigate('/tai-khoan')
            }}
          >
            Tài khoản
          </MenuItem>

          <MenuItem
            icon={theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            onClick={() => setTheme(toggleTheme())}
          >
            {/* Chỉ tên đích, không "Chuyển sang…": icon mặt trời/mặt trăng đã nói
                đây là hành động, và mục menu thì vốn dĩ để bấm. */}
            {theme === 'dark' ? 'Nền sáng' : 'Nền tối'}
          </MenuItem>

          <MenuItem
            icon={<KeyRound size={14} />}
            onClick={() => {
              dong(false)
              navigate('/doi-mat-khau')
            }}
          >
            Đổi mật khẩu
          </MenuItem>

          <div className="border-t border-line">
            <MenuItem
              icon={<LogOut size={14} />}
              onClick={() => {
                dong(false)
                void logout()
              }}
            >
              Đăng xuất
            </MenuItem>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MenuItem({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left font-mono text-[13px] text-ink-3 transition-colors duration-120 ease-linear hover:bg-surface-sel hover:text-ink-1 focus-visible:bg-surface-sel focus-visible:text-ink-1"
    >
      <span aria-hidden className="text-ink-5">
        {icon}
      </span>
      {children}
    </button>
  )
}
