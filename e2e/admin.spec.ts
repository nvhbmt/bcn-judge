/**
 * Luồng của admin: cấp tài khoản, mở khoá, xếp team, xem tình trạng chấm.
 *
 * Cụm này từng KHÔNG AI TỚI ĐƯỢC — route có, nhưng không màn hình nào link tới
 * (sửa ở commit 6bd5cdb). Vì vậy mọi test ở đây đi bằng cách BẤM từ thanh trên
 * chứ không `page.goto` thẳng URL: nếu lối vào biến mất lần nữa, test đỏ.
 */
import { expect, test } from '@playwright/test'
import { authFile, watchForErrors } from './helpers'

/* Nạp sẵn phiên của admin — xem e2e/auth.setup.ts. */
test.use({ storageState: authFile('admin') })

test('vào cụm quản trị bằng cách bấm, không phải gõ URL', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/')

  await page.getByRole('link', { name: '~/quản-trị' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tình trạng chấm')

  // Thanh điều hướng của cụm phải đủ 5 mục và mục nào cũng bấm sang được.
  const nav = page.getByRole('navigation', { name: 'Quản trị' })
  for (const [label, heading] of [
    ['Tài khoản', 'Tài khoản'],
    ['Khoá học', 'Khoá học'],
    ['Team', 'Team'],
    ['Cài đặt', 'Cài đặt'],
  ] as const) {
    await nav.getByRole('link', { name: label }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading)
  }
  expect(errors).toEqual([])
})

test('cấp tài khoản mới và nhận mật khẩu ban đầu (FR-A2)', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/quan-tri/tai-khoan')

  const email = `e2e-user-${Date.now()}@test.local`
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Họ và tên').fill('Người E2E')
  await page.getByRole('button', { name: /Tạo tài khoản/ }).last().click()

  // Mật khẩu ban đầu chỉ hiện MỘT lần — phải thấy được ngay tại đây.
  await expect(page.getByText(/[A-Za-z0-9]{10}/).first()).toBeVisible({ timeout: 20_000 })

  // Và người vừa tạo phải có mặt trong danh sách.
  await page.getByPlaceholder(/Tìm theo email/).fill(email)
  await expect(page.getByText(email).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('trang tình trạng chấm hiện worker và hàng đợi (FR-H3)', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/quan-tri')

  await expect(page.getByText('Worker', { exact: true })).toBeVisible()
  // Worker của stack E2E đang chạy, nên trang PHẢI báo có worker sống. Nếu chỗ này
  // đỏ thì hoặc worker chết, hoặc heartbeat hỏng — cả hai đều đáng biết.
  await expect(page.getByText('Không có worker nào sống')).toHaveCount(0)
  await expect(page.getByText(/\bslot\b/).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('trang team hiện các nhóm và nút tạo team', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/quan-tri/team')

  await expect(page.getByRole('button', { name: 'Tạo team' })).toBeVisible()
  // Dữ liệu mẫu tạo 5 nhóm, mỗi nhóm 6 người.
  await expect(page.getByText(/Nhóm Alpha/)).toBeVisible()
  await expect(page.getByText(/6 thành viên/).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('trang cài đặt hiện ngôn ngữ chấm và giới hạn hệ thống', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/quan-tri/cai-dat')

  await expect(page.getByText('Ngôn ngữ chấm')).toBeVisible()
  await expect(page.getByText(/c11|C11/).first()).toBeVisible()
  expect(errors).toEqual([])
})
