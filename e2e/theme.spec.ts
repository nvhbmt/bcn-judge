/**
 * Đổi theme sáng/tối.
 *
 * Dùng phiên nạp sẵn chứ không tự đăng nhập: `/auth/login` chặn 10 lần mỗi phút
 * mỗi IP, và test này không kiểm luồng đăng nhập nên không nên tiêu hạn mức đó.
 */
import { expect, test } from '@playwright/test'
import { authFile, theme } from './helpers'

test.use({ storageState: authFile('member') })

/** Nút đổi theme nay nằm trong menu tài khoản — mở menu rồi mới bấm được. */
async function doiTheme(page: import('@playwright/test').Page, sang: 'tối' | 'sáng') {
  await page.locator('header button[aria-haspopup="menu"]').click()
  await page.getByRole('menuitem', { name: `Chuyển sang nền ${sang}` }).click()
}

test('đổi theme và nhớ lại sau khi tải lại trang', async ({ page }) => {
  await page.goto('/')
  expect(await theme(page)).toBe('light')

  await doiTheme(page, 'tối')
  expect(await theme(page)).toBe('dark')

  // Nhớ qua lần tải lại, và đặt TRƯỚC lần vẽ đầu nên không chớp sáng.
  await page.reload()
  expect(await theme(page)).toBe('dark')

  await doiTheme(page, 'sáng')
  expect(await theme(page)).toBe('light')
})

/**
 * Thanh cuộn, ô tick và bảng chọn của <select> do TRÌNH DUYỆT vẽ, không phải CSS của
 * mình. Trước đây `color-scheme` không được khai ở đâu cả, nên chúng luôn ở bảng màu
 * sáng: nền tối mà thanh cuộn vẫn trắng, chạy dọc suốt màn hình.
 *
 * Kiểm bằng giá trị TÍNH ĐƯỢC trên <html> chứ không chụp ảnh thanh cuộn: macOS dùng
 * thanh cuộn phủ rộng 0px nên ảnh chụp không có gì để so, còn `color-scheme` mới là
 * thứ quyết định màu ấy trên mọi hệ.
 */
test('color-scheme đi theo theme, không để trình duyệt tự đoán', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')

  await doiTheme(page, 'tối')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')

  // Và nhớ qua lần tải lại, cùng nhịp với token màu — không được lệch nhau một nhịp,
  // vì lệch thì có một khoảnh khắc nền tối mà thanh cuộn còn sáng.
  await page.reload()
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
})
