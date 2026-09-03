/**
 * Khung chung + thanh điều hướng của cụm trang quản trị.
 *
 * Vì sao gom vào một component: bốn trang quản trị là MỘT công việc chia bốn
 * bước (tạo tài khoản → mở khoá → xếp team → chỉnh giới hạn). Nếu mỗi trang tự
 * vẽ tiêu đề thì admin phải quay về trang chủ mới nhảy được sang bước kế.
 */
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Activity,
  ArrowLeft,
  GraduationCap,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { NavLink } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
}

/** `end` cho mục gốc để `/quan-tri` không sáng khi đang ở trang con. */
const ITEMS: NavItem[] = [
  { to: "/quan-tri", label: "Tình trạng chấm", icon: Activity },
  { to: "/quan-tri/tai-khoan", label: "Tài khoản", icon: Users },
  { to: "/quan-tri/khoa-hoc", label: "Khoá học", icon: GraduationCap },
  { to: "/quan-tri/team", label: "Team", icon: UsersRound },
  { to: "/quan-tri/cai-dat", label: "Cài đặt", icon: Settings },
];

export function AdminNav() {
  return (
    <nav aria-label="Quản trị" className="mb-5 border-b border-line">
      <ul className="flex flex-wrap gap-1">
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/quan-tri"}
              className={({ isActive }) =>
                `-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition
                 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${
                   isActive
                     ? "border-[var(--color-primary)] font-medium text-[var(--color-primary)]"
                     : "border-transparent text-ink-5 hover:text-ink-2"
                 }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AdminShell({
  title,
  description,
  back,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  /**
   * Nút hành động của trang, đặt ở góc PHẢI cùng hàng tiêu đề.
   *
   * Trước đây mỗi trang tự vẽ nút của mình ngay dưới khối tiêu đề, nên nút bị đẩy
   * xuống một hàng riêng và ba trang quản trị đặt nó ở ba độ cao khác nhau — mắt
   * phải đi tìm lại ở mỗi trang. Ở đây thì nó luôn nằm một chỗ.
   *
   * CHỈ dành cho hành động của cả trang (Tạo team, Tạo khoá). Ô tìm và bộ lọc KHÔNG
   * lên đây: chúng thuộc về danh sách bên dưới và phải đứng cạnh danh sách đó.
   */
  actions?: ReactNode;
  /** Lối về danh sách, cho các trang con. Shell vẽ nó TRƯỚC tiêu đề — để trang tự
   *  vẽ thì nó rơi xuống dưới h1, đọc thành "tiêu đề rồi mới quay lại". */
  back?: { to: string; label: string };
  children: ReactNode;
}) {
  return (
    <PageContainer>
      <AdminNav />
      {back ? (
        <NavLink
          to={back.to}
          className="mb-3 inline-flex items-center gap-1 text-sm text-ink-5 hover:underline"
        >
          <ArrowLeft size={15} /> {back.label}
        </NavLink>
      ) : null}
      <header className="mb-4 flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[26px] text-ink-1">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-ink-5">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </header>
      {children}
    </PageContainer>
  );
}
