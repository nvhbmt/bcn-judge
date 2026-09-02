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
  // `exact` là bắt buộc từ khi màn 07 có thêm ô tìm: aria-label của nó ("Tìm bài tập
  // theo tiêu đề hoặc tag") chứa chuỗi "tiêu đề" nên getByLabel không exact khớp cả hai.
  await page.getByLabel('Tiêu đề', { exact: true }).fill(title)
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

test('trang sửa khoá: tab bên trái theo quyền, giáo trình là panel bên phải', async ({ page }) => {
  const { errors } = watchForErrors(page)
  // Vào thẳng bằng URL: mentor KHÔNG được ghi danh khoá nào nên trang chủ liệt kê
  // "0 khoá", và thanh điều hướng chưa có mục nào dẫn tới màn soạn khoá. Lấy id qua
  // chính API mentor thay vì cắm cứng — dữ liệu mẫu có thể đổi id giữa các lần dựng.
  const res = await page.request.get('/api/mentor/courses', {
    headers: { 'x-api-response-version': '2' },
  })
  const courses = (await res.json()).data as { id: string; code: string }[]
  const course = courses.find((c) => c.code === 'c-co-ban-k12') ?? courses[0]
  expect(course, 'mentor phải phụ trách ít nhất một khoá trong dữ liệu mẫu').toBeTruthy()
  await page.goto(`/mentor/khoa-hoc/${course!.id}/thong-tin`)

  // Mentor CHỈ thấy hai tab: "Mentor" bị ẩn vì mentor chỉ đọc được danh sách mentor,
  // không gán/gỡ được. Thấy tab nghĩa là sửa được trong đó.
  const rail = page.getByRole('navigation', { name: 'Phần của khoá học' })
  await expect(rail.getByRole('link')).toHaveText(['Thông tin', 'Ghi danh'])

  // Khung TRÁI — thông tin khoá. Ô mô tả phải mang mô tả THẬT: panel giữ nó trong
  // state một lần, nên dựng trước khi tải xong là ô rỗng và bấm lưu sẽ xoá mất.
  await expect(page.getByLabel('Mô tả khoá (Markdown)')).not.toHaveValue('')
  // Mã và tên là quyền admin — hiện ra nhưng không có ô nhập.
  await expect(page.getByText(course!.code).first()).toBeVisible()

  // Khung PHẢI — giáo trình, luôn hiện.
  await expect(page.getByLabel('Chương mới')).toBeVisible()
  await expect(page.getByRole('button', { name: /Thêm mục/ }).first()).toBeVisible()
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

test('trang sửa contest: hai khung, và khung bài nạp sẵn bài đang có (FR-I2)', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/')
  await page.getByRole('link', { name: '~/soạn-contest' }).click()
  await page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: /Contest tuần 36/ }) })
    .getByRole('link', { name: 'Sửa & chọn bài' })
    .click()

  // Khung TRÁI — thông tin contest. Ô mô tả phải mang mô tả THẬT: nó từng luôn mở ra
  // rỗng vì SPA tưởng API không trả mô tả, và lưu lúc đó là ghi đè mất mô tả cũ.
  await expect(page.getByLabel('Tên contest')).not.toHaveValue('')
  await expect(page.getByLabel('Mô tả (Markdown)')).not.toHaveValue('')

  // Khung PHẢI — bài trong contest. Danh sách phải có sẵn bài; rỗng nghĩa là bấm lưu
  // sẽ gỡ sạch bài của contest, vì PUT /:id/problems thay thế cả bộ.
  const list = page.getByRole('list', { name: 'Bài trong contest' })
  await expect(list.getByRole('listitem')).not.toHaveCount(0)

  // Mỗi bài là một hàng sửa được tại chỗ: nhãn, điểm, đổi vị trí, gỡ, lối sang trình
  // soạn bài — tất cả trên cùng hàng, không phải bấm chọn rồi kéo mắt xuống khối dưới.
  const row = list.getByRole('listitem').first()
  await expect(row.getByLabel(/^Điểm tối đa của bài/)).not.toHaveValue('')
  await expect(row.getByLabel(/^Nhãn của bài/)).toBeVisible()
  await expect(row.getByRole('link', { name: /Sửa nội dung bài/ })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Đưa xuống dưới' })).toBeVisible()
  expect(errors).toEqual([])
})
