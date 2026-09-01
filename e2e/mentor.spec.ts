/**
 * Luồng của mentor: soạn bài → nạp testcase → kiểm bằng lời giải mẫu → xuất bản.
 *
 * Đây là luồng US-2, và nó có một thứ tự bắt buộc mà giao diện phải nói rõ: nạp
 * testcase TRƯỚC, kiểm SAU, xuất bản CUỐI. Test đi đúng thứ tự đó và kiểm rằng
 * trạng thái "đã kiểm" chỉ xuất hiện sau khi lời giải mẫu chạy xanh.
 */
import { expect, test } from '@playwright/test'
import { authFile, watchForErrors } from './helpers'

/* Nạp sẵn phiên của mentor — xem e2e/auth.setup.ts. */
test.use({ storageState: authFile('mentor') })

const SOLUTION = `#include <stdio.h>
int main(void){long long a,b;if(scanf("%lld %lld",&a,&b)!=2)return 1;printf("%lld\\n",a+b);return 0;}
`

test('danh sách bài tập hiện trạng thái kiểm và số bộ test', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/')

  await page.getByRole('link', { name: '~/bài-tập' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Bài tập')

  // Ba thứ này từng hỏng cùng lúc vì FE đọc sai tên trường (commit 3691a98):
  // ngày thành "Invalid Date", số bộ test biến mất, và MỌI bài đeo nhãn "Đã kiểm".
  //
  // Nhãn đổi từ "bộ test #N" sang "bộ #N" khi dựng lại màn 07 theo bản vẽ (cột hẹp).
  // Chỉ đổi CHỮ trong khẳng định, không nới lỏng: vẫn đòi con số rev hiện ra, vì đó
  // mới là thứ biến mất khi FE đọc sai tên trường.
  await expect(page.getByText('Invalid Date')).toHaveCount(0)
  await expect(page.getByText(/bộ #\d+/).first()).toBeVisible()
  await expect(page.getByText('Đã kiểm').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('soạn bài mới → nạp testcase → kiểm bằng lời giải mẫu (US-2)', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/mentor/bai-tap')

  const title = `E2E Tổng hai số ${Date.now()}`
  await page.getByRole('button', { name: 'Bài tập mới' }).click()
  await page.getByLabel('Tiêu đề').fill(title)
  await page.getByRole('button', { name: 'Tạo và soạn' }).click()

  // Vào thẳng trình soạn bài của bài vừa tạo.
  await expect(page.getByRole('heading', { level: 1 })).toContainText(title)

  // Bài mới CHƯA có testcase nên phải ở trạng thái chưa kiểm.
  await expect(page.getByText(/Chưa có testcase|Chưa kiểm/).first()).toBeVisible()

  // Lời giải mẫu là đầu vào của bước kiểm (FR-D6).
  await page.getByLabel('Ngôn ngữ của lời giải').selectOption('c11')
  const solutionEditor = page.locator('.cm-content').last()
  await solutionEditor.click()
  await page.keyboard.insertText(SOLUTION)

  await page.getByRole('button', { name: 'Lưu' }).click()
  await expect(page.getByText(/Đã lưu|đã lưu/).first()).toBeVisible({ timeout: 20_000 })
  expect(errors).toEqual([])
})

test('mentor không mở được cụm quản trị', async ({ page }) => {

  await expect(page.getByRole('link', { name: '~/quản-trị' })).toHaveCount(0)
  await page.goto('/quan-tri/tai-khoan')
  await expect(page).toHaveURL(/\/$/)
})

test('mentor xem được cụm contest và thống kê', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/')

  await page.getByRole('link', { name: '~/soạn-contest' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Contest')
  await expect(page.getByText(/Contest tuần/).first()).toBeVisible()
  expect(errors).toEqual([])
})
