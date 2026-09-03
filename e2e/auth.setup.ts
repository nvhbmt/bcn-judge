/**
 * Đăng nhập MỘT lần cho mỗi vai trò rồi cất cookie ra file, để các spec khác nạp
 * thẳng trạng thái đã đăng nhập.
 *
 * Vì sao phải làm vậy: `/auth/login` chặn 10 lần đăng nhập mỗi phút mỗi IP
 * (server/src/auth/routes.ts) — chống dò mật khẩu, hoàn toàn đúng. Nếu mỗi test tự
 * đăng nhập thì cả bộ ~25 lần trong hai phút sẽ tự đâm vào chính cơ chế đó, và
 * test đỏ vì bảo mật chứ không phải vì sản phẩm hỏng. Đây cũng là lỗi tôi đã gặp
 * một lần ở scripts/judge-e2e.mjs.
 *
 * `auth.spec.ts` CỐ Ý không dùng trạng thái này: nó kiểm chính luồng đăng nhập.
 */
import { test as setup, expect } from '@playwright/test'
import { ACCOUNTS } from './helpers'

for (const role of ['admin', 'mentor', 'leader', 'member'] as const) {
  setup(`đăng nhập sẵn: ${role}`, async ({ page }) => {
    const { email, password } = ACCOUNTS[role]
    await page.goto('/dang-nhap')
    await page.getByLabel('Email hoặc username').fill(email)
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible()

    await page.context().storageState({ path: `e2e/.auth/${role}.json` })
  })
}
