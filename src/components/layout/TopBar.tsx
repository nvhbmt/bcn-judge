/**
 * Thanh trên 56px — điều hướng toàn cục của app (màn 02–03, 05–08 của bản v2).
 *
 * Vì sao nó tồn tại: trước bản v2 app KHÔNG có header toàn cục, `CoursesPage` kiêm
 * luôn vai trò đó. Hệ quả là mọi cụm không được `CoursesPage` link tới thì không ai
 * mở được — cụm `/quan-tri` từng như vậy (sửa ở commit 6bd5cdb), và `/contest` cũng
 * vậy. Đặt điều hướng vào một chỗ duy nhất để lỗi đó không tái diễn.
 *
 * Nav dùng mono kiểu đường dẫn shell (`~/khoá-học`) — chữ ký của hệ thiết kế. Mục
 * đang mở nhận NỀN `--surface-code` chứ không đổi màu chữ: thiết kế đánh dấu trạng
 * thái bằng nền và đường kẻ, không bằng màu nhấn rải rác. Chỉ liệt kê route CÓ THẬT;
 * thêm mục ở đây mà quên khai route trong App.tsx là tạo link chết.
 *
 * KHÔNG có ô `⌘K tìm bài` như bản vẽ: app chưa có tìm kiếm toàn cục, và chính hợp
 * đồng nội dung của hệ thiết kế cấm vẽ thứ chưa chạy được ("Chức năng đang được
 * phát triển" → bỏ khỏi màn hình). Thêm lại khi nào tính năng có thật.
 *
 * Xem design-system/readme.md.
 */
import { LogOut, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Avatar } from '@/components/ui/patterns'
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

/** Vai trò hiện thành chip viền: mentor xanh rêu, admin nâu đất đỏ. Member không có chip. */
function RoleChip({ role }: { role: string }) {
  if (role === 'admin') {
    return <span className="border border-clay px-2.5 py-1 font-mono text-[11px] text-clay">ADMIN</span>
  }
  if (role === 'mentor') {
    return <span className="border border-moss px-2.5 py-1 font-mono text-[11px] text-moss">MENTOR</span>
  }
  return null
}

export function TopBar() {
  const { me, logout } = useAuth()
  const [theme, setTheme] = useState<Theme>(() => currentTheme())
  if (!me) return null

  return (
    <header className="flex h-14 shrink-0 items-center gap-6 border-b border-line bg-surface-1 px-7">
      {/* Chữ ký thứ hai của hệ: khối 14×7px moss ngay sau chữ BCN, chân chữ thẳng hàng. */}
      <span className="flex shrink-0 items-end gap-2">
        <span className="font-mono text-[13px] font-bold tracking-[0.06em] text-ink-1">BCN</span>
        <span aria-hidden className="mb-[3px] h-[7px] w-[14px] bg-moss" />
      </span>

      <nav aria-label="Điều hướng chính" className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
        {navFor(me.role).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `px-3 py-1.5 font-mono text-[12px] whitespace-nowrap transition-colors duration-[120ms] ease-linear ${
                isActive ? 'bg-surface-code text-ink-1' : 'text-ink-5 hover:text-ink-2'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <RoleChip role={me.role} />
        <span className="hidden font-mono text-[12px] text-ink-2 sm:inline">{me.displayName}</span>
        <Avatar name={me.displayName} chars={1} />
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
