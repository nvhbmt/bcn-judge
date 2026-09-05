/**
 * Mọi route mở được, không route nào ném lỗi.
 *
 * Đây là lưới chắn thô nhất nhưng bắt được đúng lớp lỗi đã xảy ra hai lần trong
 * dự án này: một cụm trang có route nhưng hỏng/không ai tới được. Test đi tới TỪNG
 * route bằng URL và soi console + response 5xx.
 */
import { expect, test } from '@playwright/test'
import { login, watchForErrors } from './helpers'

/**
 * Route tĩnh theo vai trò. Route có tham số kiểm ở các spec luồng.
 *
 * Danh sách này là THỦ CÔNG, nên tên test "mọi route" chỉ đúng bằng chính nó: thêm
 * một trang vào App.tsx mà quên thêm vào đây là trang đó không bao giờ được mở lần
 * nào — đúng lớp lỗi mà file này sinh ra để chắn. Thêm route mới thì thêm cả ở đây.
 */
const ROUTES = {
  member: ['/', '/contest', '/team', '/tai-khoan'],
  mentor: ['/', '/contest', '/team', '/tai-khoan', '/mentor/bai-tap', '/mentor/contest'],
  admin: [
    '/', '/contest', '/team', '/tai-khoan', '/mentor/bai-tap', '/mentor/contest',
    '/quan-tri', '/quan-tri/tai-khoan', '/quan-tri/khoa-hoc', '/quan-tri/team', '/quan-tri/cai-dat',
    '/quan-tri/nhat-ky',
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

      // KHÔNG được có thanh cuộn TRANG. Cả app là `h-full` với các khung tự cuộn
      // bên trong; một thanh cuộn trang mọc thêm là dấu hiệu có gì đó thoát ra khỏi
      // hộp, và nó chồng lên thanh cuộn của khung.
      //
      // Đã bắt được một ca thật: nhãn `sr-only` trong bảng testcase là
      // `position: absolute` mà không có tổ tiên nào được định vị, nên nó neo vào
      // khung ban đầu của trang ở đúng toạ độ tài liệu của nó và kéo dài trang thêm
      // 160px. Lớp lỗi này im lặng và chỉ lộ ra ở một tab cụ thể.
      const thua = await page.evaluate(
        () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
      )
      expect(thua, `${route} mọc thêm thanh cuộn trang`).toBeLessThanOrEqual(1)
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
