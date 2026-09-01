/**
 * Đổi theme sáng/tối.
 *
 * Dùng phiên nạp sẵn chứ không tự đăng nhập: `/auth/login` chặn 10 lần mỗi phút
 * mỗi IP, và test này không kiểm luồng đăng nhập nên không nên tiêu hạn mức đó.
 */
import { expect, test } from '@playwright/test'
import { authFile, theme } from './helpers'

test.use({ storageState: authFile('member') })

test('đổi theme và nhớ lại sau khi tải lại trang', async ({ page }) => {
  await page.goto('/')
  expect(await theme(page)).toBe('light')

  await page.getByRole('button', { name: 'Chuyển sang nền tối' }).click()
  expect(await theme(page)).toBe('dark')

  // Nhớ qua lần tải lại, và đặt TRƯỚC lần vẽ đầu nên không chớp sáng.
  await page.reload()
  expect(await theme(page)).toBe('dark')
  await expect(page.getByRole('button', { name: 'Chuyển sang nền sáng' })).toBeVisible()

  await page.getByRole('button', { name: 'Chuyển sang nền sáng' }).click()
  expect(await theme(page)).toBe('light')
})
