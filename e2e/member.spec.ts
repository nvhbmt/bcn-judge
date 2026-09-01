/**
 * Luồng của member: trang chủ → khoá → bài → gõ code → chạy thử → nộp → verdict.
 *
 * Đây là luồng đắt nhất nhưng cũng là lý do hệ thống tồn tại. Nộp bài đi qua hàng
 * đợi Postgres, worker và container Docker thật, nên các test ở đây chậm hơn hẳn
 * phần còn lại — đó là cái giá của việc kiểm THẬT thay vì mock.
 */
import { expect, test, type Page } from '@playwright/test'
import { authFile, waitForVerdict, watchForErrors } from './helpers'

/* Nạp sẵn phiên của leader — xem e2e/auth.setup.ts. */
test.use({ storageState: authFile('leader') })

const AC_SOURCE = `#include <stdio.h>
int main(void){long long a,b;if(scanf("%lld %lld",&a,&b)!=2)return 1;printf("%lld\\n",a+b);return 0;}
`
const WA_SOURCE = `#include <stdio.h>
int main(void){long long a,b;scanf("%lld %lld",&a,&b);printf("%lld\\n",a-b);return 0;}
`

/** Mở bài "Tổng hai số" của khoá C cơ bản — bài đầu tiên trong giáo trình. */
async function openFirstProblem(page: Page): Promise<void> {
  await page.getByRole('link', { name: /C cơ bản/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('C cơ bản')
  await page.getByRole('link', { name: 'Tổng hai số' }).first().click()
  await expect(page.getByRole('heading', { name: 'Tổng hai số' })).toBeVisible()
}

/** Gõ vào CodeMirror: click vào vùng soạn rồi gõ như người thật. */
async function typeCode(page: Page, source: string): Promise<void> {
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  // `insertText` tránh việc tự động đóng ngoặc của editor làm hỏng mã nguồn.
  await page.keyboard.insertText(source)
}

test('trang chủ hiện khoá học, tiến độ, contest và log', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Chào')
  await expect(page.getByRole('link', { name: /C cơ bản/ })).toBeVisible()
  // Tiến độ tính từ giáo trình — có số nghĩa là truy vấn chạy được.
  await expect(page.getByText(/\d+\/\d+ AC/).first()).toBeVisible()
  await expect(page.getByText('Log của bạn')).toBeVisible()
  expect(errors).toEqual([])
})

test('mở khoá → giáo trình theo chương → mở bài', async ({ page }) => {
  await page.goto('/')
  await openFirstProblem(page)

  // Màn làm bài: đề bên trái, editor bên phải.
  await expect(page.getByText('Dữ liệu vào')).toBeVisible()
  await expect(page.locator('.cm-content')).toBeVisible()
})

test('thanh icon đổi panel bên trái (FR-E7)', async ({ page }) => {
  await page.goto('/')
  await openFirstProblem(page)

  const rail = page.getByRole('navigation').filter({ hasNot: page.getByText('~/khoá-học') })
  await rail.getByRole('button', { name: 'Trợ giúp' }).click()
  await expect(page.getByText(/Làm bài thế nào/)).toBeVisible()

  await rail.getByRole('button', { name: 'Giáo trình' }).click()
  await expect(page.getByText(/Chương 1/)).toBeVisible()

  await rail.getByRole('button', { name: 'Bảng xếp hạng' }).click()
  await expect(page.getByText(/Bảng xếp hạng|Chưa có/).first()).toBeVisible()

  // Bản v2 gộp về MỘT lớp tab: "Đề bài" và "Bài nộp" nay cũng là icon trên rail, nên
  // mục đưa về đề bài đổi tên từ "Mô tả" thành "Đề bài" (pages/workspace/rail.tsx).
  await rail.getByRole('button', { name: 'Đề bài' }).click()
  await expect(page.getByRole('heading', { name: 'Tổng hai số' })).toBeVisible()
})

test('chạy thử trên testcase mẫu, không tính vào lịch sử nộp (FR-F1)', async ({ page }) => {
  await page.goto('/')
  await openFirstProblem(page)
  await typeCode(page, AC_SOURCE)

  await page.getByRole('button', { name: 'Chạy thử' }).click()

  // Bám vào chính BẢNG kết quả, không phải vào một con số nào đó có trên màn hình:
  // bản trước khẳng định "thấy chữ 8" trong khi 8 đã nằm sẵn ở khối ví dụ của đề từ
  // trước lúc bấm, nên nó xanh kể cả khi nút Chạy thử không làm gì cả.
  const console_ = page.locator('[role="tablist"]').last()
  await expect(console_.getByRole('tab', { name: 'chạy thử' })).toHaveAttribute('aria-selected', 'true')
  const row = page.getByRole('row').filter({ hasText: '#1' }).first()
  await expect(row).toContainText('mẫu')
  await expect(row.getByText('AC')).toBeVisible({ timeout: 60_000 })
})

test('tab stdin tự nhập: gõ input, chạy và đọc output ngay tại chỗ', async ({ page }) => {
  await page.goto('/')
  await openFirstProblem(page)
  await typeCode(page, AC_SOURCE)

  await page.getByRole('tab', { name: 'stdin tự nhập' }).click()
  // Input KHÁC hẳn testcase mẫu (3 5 → 8), để output không thể trùng thứ đã có sẵn
  // trên màn hình — 111 + 222 = 333 không xuất hiện ở đâu khác trong trang.
  await page.getByLabel(/Chương trình đọc đúng những gì bạn gõ/).fill('111 222\n')
  await page.getByRole('button', { name: 'Chạy với input này' }).click()

  // Ở lại đúng tab đó — cả vòng gõ-chạy-đọc không phải rời chỗ nào.
  await expect(page.getByRole('tab', { name: 'stdin tự nhập' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('333')).toBeVisible({ timeout: 60_000 })
})

test('testcase mẫu sai thì chỉ ra đúng chỗ lệch, không bắt tự dò', async ({ page }) => {
  await page.goto('/')
  await openFirstProblem(page)
  await typeCode(page, WA_SOURCE)

  await page.getByRole('button', { name: 'Chạy thử' }).click()

  // Bài mẫu có HAI testcase mẫu và cả hai đều sai, nên trên màn hình có hai bảng so
  // giống hệt nhau — chỉ đích danh bảng của test #1 bằng tên trợ năng của nó.
  const diff = page.getByRole('group', { name: 'So output testcase mẫu #1' })
  await expect(diff).toBeVisible({ timeout: 60_000 })
  await expect(diff.getByText('khác từ dòng 1')).toBeVisible()
  await expect(diff.getByText('output của bạn')).toBeVisible()
  await expect(diff.getByText('đáp án đúng')).toBeVisible()

  // 3 - 5 = -2, đáp án đúng là 8: khoảng được tô phải đúng bằng hai giá trị đó chứ
  // không phải cả dòng. Đây mới là thứ chứng minh phần tô sáng chạy thật.
  await expect(diff.locator('mark')).toHaveText(['-2', '8'])
})

test('nộp bài đúng → AC, nộp bài sai → WA, cả hai vào lịch sử', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/')
  await openFirstProblem(page)

  await typeCode(page, AC_SOURCE)
  await page.getByRole('button', { name: 'Nộp bài' }).click()
  expect(await waitForVerdict(page)).toBe('AC')

  await typeCode(page, WA_SOURCE)
  await page.getByRole('button', { name: 'Nộp bài' }).click()
  await expect(async () => {
    expect(await waitForVerdict(page)).toBe('WA')
  }).toPass({ timeout: 60_000 })

  // "Bài nộp" phải thấy cả hai lần. Bản v2 gộp về một lớp tab nên nó là một icon trên
  // rail chứ không còn là tab riêng dưới khung nội dung.
  const rail = page.getByRole('navigation').filter({ hasNot: page.getByText('~/khoá-học') })
  await rail.getByRole('button', { name: 'Bài nộp' }).click()
  await expect(page.getByText('AC', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('WA', { exact: true }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('danh sách contest → chi tiết → bảng xếp hạng', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/')

  await page.getByRole('link', { name: '~/contest' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Contest')
  await expect(page.getByText('Đang diễn ra').first()).toBeVisible()

  await page.getByRole('link', { name: /Contest tuần 36/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Contest tuần 36')
  // Đếm ngược và bảng xếp hạng đều phải có số thật.
  await expect(page.getByText(/\d+:\d+:\d+/).first()).toBeVisible()
  await expect(page.getByText('Bảng xếp hạng').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('leader xem được tiến độ và bài nộp của nhóm (FR-J)', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/')

  await page.getByRole('link', { name: '~/team' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Nhóm')
  await expect(page.getByText('Tiến độ theo khoá')).toBeVisible()
  // Bảng tiến độ có dòng cho từng thành viên.
  await expect(page.getByText(/\d+\/\d+/).first()).toBeVisible()
  expect(errors).toEqual([])
})
