/**
 * Thanh trên 48px — điều hướng toàn cục của app.
 *
 * Vì sao nó tồn tại: trước bản v2 app KHÔNG có header toàn cục, `CoursesPage` kiêm
 * luôn vai trò đó. Hệ quả là mọi cụm không được `CoursesPage` link tới thì không ai
 * mở được — cụm `/quan-tri` từng như vậy (sửa ở commit 6bd5cdb), và `/contest` cũng
 * vậy. Đặt điều hướng vào một chỗ duy nhất để lỗi đó không tái diễn.
 *
 * Nav dùng mono kiểu đường dẫn shell (`~/khoá-học`) — đây là chữ ký của hệ thiết kế,
 * xem `design-system/readme.md`. Chỉ liệt kê route CÓ THẬT; thêm mục ở đây mà quên
 * khai route trong App.tsx là tạo link chết.
 */
import { LogOut, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import logo from '@/assets/logo-bcn.png'
import { currentTheme, toggleTheme, type Theme } from '@/lib/theme'
import { useAuth } from '@/stores/auth'

interface NavItem {
  to: string
  label: string
  end?: boolean
}

/** Route phải khớp App.tsx. Member thấy 3 mục đầu; staff và admin thấy thêm. */
function navFor(role: string): NavItem[] {
  const items: NavItem[] = [
    { to: '/', label: '~/khoá-học', end: true },
    { to: '/contest', label: '~/contest' },
    { to: '/team', label: '~/team' },
  ]
  if (role !== 'member') {
    items.push({ to: '/mentor/bai-tap', label: '~/bài-tập' }, { to: '/mentor/contest', label: '~/soạn-contest' })
  }
  if (role === 'admin') items.push({ to: '/quan-tri', label: '~/quản-trị' })
  return items
}

export function TopBar() {
  const { me, logout } = useAuth()
  const [theme, setTheme] = useState<Theme>(() => currentTheme())
  if (!me) return null

  return (
    <header className="flex h-12 shrink-0 items-center gap-6 border-b border-line bg-surface-1 px-4">
      <span className="flex items-center gap-2">
        <img src={logo} alt="" aria-hidden className="h-5 w-5 opacity-80" />
        <span className="font-mono text-[13px] font-semibold tracking-[0.06em] text-ink-1">BCN</span>
        {/* Khối 14×7px sau chữ BCN — chữ ký thứ hai của hệ thiết kế. */}
        <span aria-hidden className="h-[7px] w-[14px] bg-moss" />
      </span>

      <nav aria-label="Điều hướng chính" className="flex items-center gap-1">
        {navFor(me.role).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `px-2 py-1 font-mono text-[12px] tracking-[0.06em] transition-colors duration-[120ms] ease-linear ${
                isActive ? 'text-moss' : 'text-ink-5 hover:text-ink-2'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <span className="font-mono text-[12px] text-ink-5">{me.displayName}</span>
        <button
          type="button"
          onClick={() => setTheme(toggleTheme())}
          aria-label={theme === 'dark' ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'}
          title={theme === 'dark' ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'}
          className="inline-flex size-7 items-center justify-center text-ink-5 transition-colors duration-[120ms] ease-linear hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          type="button"
          onClick={() => void logout()}
          aria-label="Đăng xuất"
          title="Đăng xuất"
          className="inline-flex size-7 items-center justify-center text-ink-5 transition-colors duration-[120ms] ease-linear hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  )
}
