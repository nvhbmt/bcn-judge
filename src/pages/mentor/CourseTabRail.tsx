/**
 * Thanh tab dọc bên trái của màn sửa khoá.
 *
 * Là `<a>` chứ không phải nút: mỗi tab có URL riêng
 * (`/mentor/khoa-hoc/:id/giao-trinh`), nên tải lại trang vẫn ở đúng tab, và gửi cho
 * đồng nghiệp thì họ mở ra đúng chỗ mình đang nói.
 */
import { NavLink } from 'react-router-dom'
import type { CourseTab } from './courseTabs'

export function CourseTabRail({ courseId, tabs }: { courseId: string; tabs: CourseTab[] }) {
  return (
    <nav aria-label="Phần của khoá học" className="shrink-0 border-r border-line bg-surface-1 sm:w-48">
      <ul className="flex overflow-x-auto sm:block">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <NavLink
              to={`/mentor/khoa-hoc/${courseId}/${tab.id}`}
              className={({ isActive }) =>
                `block border-l-2 px-4 py-2.5 text-sm whitespace-nowrap transition-colors duration-[120ms]
                 ease-linear focus-visible:outline-2 focus-visible:outline-offset-[-2px]
                 focus-visible:outline-moss ${
                   isActive
                     ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] font-medium text-ink-1'
                     : 'border-transparent text-ink-4 hover:bg-surface-sel hover:text-ink-2'
                 }`
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
