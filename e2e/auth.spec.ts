/**
 * Luồng đăng nhập, đăng xuất, đổi mật khẩu lần đầu, và đổi theme.
 *
 * FR-A2 (bắt đổi mật khẩu lần đầu) là cổng chặn cứng: chưa đổi thì KHÔNG vào được
 * màn nào khác, kể cả gõ tay URL. Test đó tạo tài khoản mới qua đường admin để có
 * một người thật sự chưa đổi mật khẩu.
 */
import { expect, test } from '@playwright/test'
import { ACCOUNTS, login, logout, theme, watchForErrors } from './helpers'

test('đăng nhập đúng thì vào trang chủ và thấy tên mình', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await login(page, 'member')

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Chào')
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toContainText('~/khoá-học')
  expect(errors).toEqual([])
})

test('sai mật khẩu thì báo lỗi và ở lại màn đăng nhập', async ({ page }) => {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email hoặc username').fill(ACCOUNTS.member.email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill('sai-mat-khau-roi')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible()
})

test('tài khoản bị khoá không đăng nhập được (FR-A4)', async ({ page }) => {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email hoặc username').fill(ACCOUNTS.disabled.email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(ACCOUNTS.disabled.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/dang-nhap/)
})

test('nút hiện mật khẩu đổi kiểu ô nhập', async ({ page }) => {
  await page.goto('/dang-nhap')
  const field = page.getByLabel('Mật khẩu', { exact: true })
  await expect(field).toHaveAttribute('type', 'password')

  await page.getByRole('button', { name: 'Hiện mật khẩu' }).click()
  await expect(field).toHaveAttribute('type', 'text')

  await page.getByRole('button', { name: 'Ẩn mật khẩu' }).click()
  await expect(field).toHaveAttribute('type', 'password')
})

test('đăng xuất rồi thì không vào lại được bằng URL', async ({ page }) => {
  await login(page, 'member')
  await logout(page)

  await page.goto('/team')
  await expect(page).toHaveURL(/dang-nhap/)
})

test('mật khẩu admin cấp phải đổi ở lần đăng nhập đầu (FR-A2)', async ({ page, request }) => {
  // Tạo một người mới tinh qua API admin để có tài khoản CHƯA đổi mật khẩu.
  const email = `e2e-fresh-${Date.now()}@test.local`
  await request.post('/auth/login', {
    data: { emailOrUsername: ACCOUNTS.admin.email, password: ACCOUNTS.admin.password },
    headers: { 'x-api-response-version': '2' },
  })
  const created = await request.post('/api/admin/users', {
    data: { email, displayName: 'Người mới', role: 'member' },
    headers: { 'x-api-response-version': '2' },
  })
  const initialPassword = (await created.json()).data.initialPassword as string

  await page.goto('/dang-nhap')
  await page.getByLabel('Email hoặc username').fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(initialPassword)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()

  await expect(page).toHaveURL(/doi-mat-khau/)

  // Cổng chặn CỨNG: gõ tay URL khác vẫn bị đẩy về màn đổi mật khẩu.
  await page.goto('/team')
  await expect(page).toHaveURL(/doi-mat-khau/)
})
