/**
 * Mọi route mở được, không route nào ném lỗi.
 *
 * Đây là lưới chắn thô nhất nhưng bắt được đúng lớp lỗi đã xảy ra hai lần trong
 * dự án này: một cụm trang có route nhưng hỏng/không ai tới được. Test đi tới TỪNG
 * route bằng URL và soi console + response 5xx.
 */
import { expect, test } from '@playwright/test'
import { login, watchForErrors } from './helpers'

/** Route tĩnh theo vai trò. Route có tham số kiểm ở các spec luồng. */
const ROUTES = {
  member: ['/', '/contest', '/team'],
  mentor: ['/', '/contest', '/team', '/mentor/bai-tap', '/mentor/contest'],
  admin: [
    '/', '/contest', '/team', '/mentor/bai-tap', '/mentor/contest',
    '/quan-tri', '/quan-tri/tai-khoan', '/quan-tri/khoa-hoc', '/quan-tri/team', '/quan-tri/cai-dat',
  ],
} as const

for (const role of ['member', 'mentor', 'admin'] as const) {
  test(`${role}: mọi route mở được và không có lỗi`, async ({ page }) => {
    const { errors } = watchForErrors(page)
    await login(page, role === 'member' ? 'member' : role)

    for (const route of ROUTES[role]) {
      await page.goto(route)
      // Thanh trên phải còn đó: mất nó nghĩa là app văng về màn đăng nhập.
      await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible()
      // Và trang phải có một tiêu đề — trang trắng thì không có h1 nào.
      await expect(page.locator('h1').first()).toBeVisible()
      expect(errors, `lỗi khi mở ${route}`).toEqual([])
    }
  })
}

test('member gõ tay URL quản trị thì bị đưa về trang chủ', async ({ page }) => {
  await login(page, 'member')
  await page.goto('/quan-tri/tai-khoan')

  // App.tsx không khai route quản trị cho member, nên '*' bắt và đẩy về '/'.
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Chào')
})
