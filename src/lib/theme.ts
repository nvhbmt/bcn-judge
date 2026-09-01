/**
 * Chọn theme sáng/tối.
 *
 * KHÔNG theo `prefers-color-scheme`. Người dùng tự chọn, và lựa chọn được nhớ lại —
 * đổi theme giữa lúc đang gõ code thì loá mắt, nên hệ điều hành không được quyền
 * đổi giao diện của người ta giữa chừng.
 *
 * LỆCH CÓ CHỦ ĐÍCH so với `design-system/readme.md`: tài liệu thiết kế chốt **mặc
 * định tối**, lập luận là contest và chấm bài hay diễn ra buổi tối. Ở đây mặc định
 * **sáng** theo yêu cầu của CLB. Đừng "sửa lại cho khớp thiết kế" — đây là quyết
 * định, không phải nhầm lẫn.
 *
 * Giá trị mặc định và tên khoá phải khớp với đoạn script trong `index.html`, vì
 * script đó chạy trước React để tránh chớp màn hình.
 */
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'bcn-theme'
export const DEFAULT_THEME: Theme = 'light'

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

/** Theme đang áp trên thẻ `<html>`; đọc từ DOM nên luôn khớp thứ index.html đã đặt. */
export function currentTheme(): Theme {
  const applied = document.documentElement.dataset.theme
  return isTheme(applied) ? applied : DEFAULT_THEME
}

/** Component nào cần đổi theo theme thì nghe sự kiện này (xem useTheme). */
export const THEME_EVENT = 'bcn-theme'

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Chế độ riêng tư chặn localStorage — vẫn đổi được, chỉ là không nhớ sang lần sau.
  }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }))
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}
