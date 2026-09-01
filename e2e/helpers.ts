/**
 * Tiện ích dùng chung cho bộ E2E.
 *
 * Quy ước chọn phần tử: ưu tiên `getByRole` + tên tiếng Việt hiển thị trên màn
 * hình. Không dùng `data-testid` — nếu một nút không chọn được bằng vai trò và
 * nhãn thì chính người dùng bàn phím và trình đọc màn hình cũng không dùng được
 * nó, và đó là lỗi cần sửa ở sản phẩm chứ không phải ở test (NFR-6).
 */
import { expect, type Page } from '@playwright/test'

/** Tài khoản do `db:seed:demo` tạo — xem server/src/db/seed-demo.ts. */
export const ACCOUNTS = {
  admin: { email: 'admin@bcn.local', password: 'bcnjudge' },
  mentor: { email: 'mentor1@bcn.local', password: 'matkhau123' },
  /** member1 là leader Nhóm Alpha, có bài nộp sẵn nên trang chủ có dữ liệu. */
  leader: { email: 'member1@bcn.local', password: 'matkhau123' },
  member: { email: 'member9@bcn.local', password: 'matkhau123' },
  disabled: { email: 'member32@bcn.local', password: 'matkhau123' },
} as const

/** Đường dẫn tới trạng thái đã đăng nhập do auth.setup.ts tạo. */
export const authFile = (role: 'admin' | 'mentor' | 'leader' | 'member') => `e2e/.auth/${role}.json`

/**
 * Đăng nhập bằng form. CHỈ dùng cho auth.spec — các spec khác nạp sẵn cookie qua
 * `storageState`, vì `/auth/login` chặn 10 lần mỗi phút mỗi IP.
 */
export async function login(page: Page, who: keyof typeof ACCOUNTS): Promise<void> {
  const { email, password } = ACCOUNTS[who]

  const attempt = async () => {
    await page.goto('/dang-nhap')
    await page.getByLabel('Email hoặc username').fill(email)
    await page.getByLabel('Mật khẩu').fill(password)
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
  }

  await attempt()
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })

  // Chạm giới hạn 10 lần đăng nhập/phút/IP thì ĐỢI HẾT cửa sổ rồi thử lại, chứ
  // không nới giới hạn: nó là lớp chống dò mật khẩu, bài kiểm phải sống chung.
  const rateLimited = page.getByText(/Thử lại sau \d+ giây/)
  if (await rateLimited.isVisible().catch(() => false)) {
    await page.waitForTimeout(61_000)
    await attempt()
  }

  // Thanh trên chỉ vẽ khi đã đăng nhập — dùng nó làm mốc "vào được rồi".
  await expect(nav).toBeVisible()
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Đăng xuất' }).click()
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible()
}

/** Theme đang áp trên thẻ `<html>`. */
export async function theme(page: Page): Promise<string | null> {
  return page.evaluate(() => document.documentElement.dataset.theme ?? null)
}

/**
 * Bắt lỗi console và request hỏng trong suốt một test.
 *
 * Có vì lớp lỗi hay gặp nhất khi đổi giao diện là "trang vẫn hiện nhưng một API
 * trả 500" — người xem lướt qua không nhận ra, còn `expect` trên chữ thì vẫn xanh.
 */
export function watchForErrors(page: Page): { errors: string[] } {
  const errors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    // Bỏ dòng "Failed to load resource": trình duyệt bắn nó cho MỌI phản hồi 4xx,
    // kể cả cái 401 hợp lệ của `/auth/me` lúc app dò xem đã đăng nhập chưa. Lỗi
    // mạng thật đã có listener `response` bên dưới bắt theo mã trạng thái.
    if (msg.text().startsWith('Failed to load resource')) return
    errors.push(`console: ${msg.text()}`)
  })

  // Lỗi JS chưa bắt — cái này luôn là lỗi thật.
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

  page.on('response', (res) => {
    const url = res.url()
    if (!url.includes('/api/') && !url.includes('/auth/')) return
    // 5xx luôn sai. 4xx thì tuỳ: 401 trước khi đăng nhập là bình thường, còn 403
    // và 404 ở đường đã đăng nhập là dấu hiệu route hoặc quyền hỏng.
    if (res.status() >= 500) errors.push(`${res.status()} ${url}`)
  })

  return { errors }
}

/**
 * Chờ một bài nộp chấm xong rồi trả verdict.
 *
 * Chọn bằng CHỮ hiện trên màn hình chứ không bằng data-testid: verdict là thứ
 * người dùng đọc, nên nếu không tìm được bằng chữ thì người dùng cũng không thấy.
 * Chấm đi qua Docker thật nên có thể mất vài giây.
 */
export async function waitForVerdict(page: Page, timeout = 60_000): Promise<string> {
  const badge = page.getByText(/^(AC|WA|TLE|MLE|RE|CE|IE)$/).first()
  await expect(badge).toBeVisible({ timeout })
  return ((await badge.textContent()) ?? '').trim()
}
