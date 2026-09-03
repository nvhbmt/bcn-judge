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

test('trang Khoá học: đếm member đúng và có lối sang màn soạn nội dung', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/quan-tri/khoa-hoc')

  // `memberCount` từng LUÔN bằng 0 dù khoá có 32 người: truy vấn con dùng nội suy cột
  // của drizzle, render ra `"id"` không kèm tên bảng, nên dính vào `course_enrollments.id`
  // và thành `ce.course_id = ce.id`. Đếm sai kiểu này không ném lỗi, chỉ ra số 0.
  const row = page.getByRole('listitem').filter({ hasText: 'c-co-ban-k12' })
  await expect(row.getByText(/\d+ member/)).toBeVisible()
  await expect(row.getByText('0 member')).toHaveCount(0)

  // MỘT lối ra duy nhất, mở màn sửa khoá. Admin thấy đủ ba tab (mentor chỉ thấy hai).
  await row.getByRole('link', { name: 'Sửa' }).click()
  await expect(page).toHaveURL(/\/mentor\/khoa-hoc\/[0-9a-f-]{36}\/thong-tin$/)
  const rail = page.getByRole('navigation', { name: 'Phần của khoá học' })
  // Thanh nay là ICON: chữ nằm ở `aria-label`, không phải nội dung thẻ — khẳng định
  // đi qua TÊN TRỢ NĂNG, cũng là thứ người dùng trình đọc màn hình nghe thấy.
  await expect(rail.getByRole('link')).toHaveCount(3)
  for (const ten of ['Thông tin', 'Ghi danh', 'Mentor']) {
    await expect(rail.getByRole('link', { name: ten })).toBeVisible()
  }

  // Giáo trình là panel PHẢI cố định — có mặt ở mọi tab, không phải bấm mới ra.
  await expect(page.getByLabel('Chương mới')).toBeVisible()

  // Tab nằm trong URL: bấm sang tab khác thì địa chỉ đổi theo, tải lại vẫn ở đó, và
  // giáo trình vẫn đứng nguyên bên phải.
  await rail.getByRole('link', { name: 'Ghi danh' }).click()
  await expect(page).toHaveURL(/\/ghi-danh$/)
  await page.reload()
  await expect(page).toHaveURL(/\/ghi-danh$/)
  await expect(page.getByLabel('Chương mới')).toBeVisible()
  expect(errors).toEqual([])
})

/**
 * Sửa có URL RIÊNG, không bung ra trong danh sách. Ba thứ chỉ đúng khi có URL riêng và
 * test canh cả ba: địa chỉ đổi, tải lại trang vẫn ở đúng chỗ, và quay về được.
 */
test('mọi thao tác sửa của cụm quản trị đều có trang riêng', async ({ page }) => {
  const { errors } = watchForErrors(page)

  for (const [list, back] of [
    ['/quan-tri/khoa-hoc', 'Danh sách khoá học'],
    ['/quan-tri/team', 'Danh sách team'],
    ['/quan-tri/cai-dat', 'Cài đặt hệ thống'],
  ] as const) {
    await page.goto(list)
    await page.getByRole('link', { name: 'Sửa' }).first().click()
    await expect(page).not.toHaveURL(new RegExp(`${list}$`))
    // Chờ mạng lặng rồi mới chụp URL: màn sửa khoá có thể còn chuyển hướng thêm một
    // nhịp sang tab mặc định, và chụp sớm thì so với URL sau khi tải lại sẽ lệch.
    await page.waitForLoadState('networkidle')

    // Tải lại: URL mang đủ ngữ cảnh nên trang phải dựng lại y nguyên, không rơi về
    // danh sách — đó chính là thứ lối sửa inline không làm được.
    const url = page.url()
    await page.reload()
    await expect(page).toHaveURL(url)

    await page.getByRole('link', { name: back }).click()
    await expect(page).toHaveURL(new RegExp(`${list}$`))
  }
  expect(errors).toEqual([])
})

test('trang tạo khoá và tạo team mở được bằng URL trực tiếp', async ({ page }) => {
  const { errors } = watchForErrors(page)

  await page.goto('/quan-tri/khoa-hoc/moi')
  // `moi` không được nuốt thành `:courseId` — nếu route đặt sai thứ tự thì trang này
  // mở ra thành "Không tìm thấy khoá học".
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tạo khoá học')
  await expect(page.getByLabel('Mã khoá')).toBeVisible()

  await page.goto('/quan-tri/team/moi')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tạo team')
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

  // `link` chứ không phải `button`: "Tạo team" giờ đi tới /quan-tri/team/moi, và điều
  // hướng phải là <a> — bấm giữa chuột, mở tab mới, copy địa chỉ đều phải dùng được.
  await expect(page.getByRole('link', { name: 'Tạo team' })).toBeVisible()
  // Dữ liệu mẫu tạo 5 nhóm, mỗi nhóm 6 người.
  await expect(page.getByText(/Nhóm Alpha/)).toBeVisible()
  await expect(page.getByText(/6 thành viên/).first()).toBeVisible()

  // TÊN từng người phải hiện ngay ở đây. Trước đó chỉ có con số "6 thành viên", nên
  // câu hỏi thường gặp nhất của admin — "ai đang ở team nào" — phải mở lần lượt từng
  // team mới trả lời được.
  const nhom = page.locator('li', { hasText: 'Nhóm Alpha' }).first()
  await expect(nhom.locator('ul li')).toHaveCount(6)

  // Và chỉ MỘT lượt gọi danh sách team, không phải một lượt cho mỗi nhóm.
  const soGoi = await page.evaluate(
    () => performance.getEntriesByType('resource').filter((r) => /\/api\/admin\/teams/.test(r.name)).length,
  )
  expect(soGoi, 'không được gọi /members cho từng team').toBeLessThanOrEqual(2)

  expect(errors).toEqual([])
})

test('trang cài đặt hiện ngôn ngữ chấm và giới hạn hệ thống', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/quan-tri/cai-dat')

  await expect(page.getByText('Ngôn ngữ chấm')).toBeVisible()
  await expect(page.getByText(/c11|C11/).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('trang Tài khoản: ô tìm và bộ lọc nằm CÙNG một hàng, mũi tên select có chỗ thở', async ({ page }) => {
  // Hai lỗi từng cùng tồn tại ở đây:
  //  - `w-40` trên <Select> THUA `w-full` trong CONTROL (cùng độ ưu tiên, thứ tự file
  //    CSS quyết định), nên select giãn hết hàng và bị đẩy xuống dòng riêng;
  //  - mũi tên xổ xuống do TRÌNH DUYỆT vẽ, đè lên mép phải, mà padding chỉ 10px nên
  //    "Mọi vai trò" chạy sát vào nó.
  // Cả hai chỉ đo được bằng bố cục thật, jsdom không tính được.
  await page.goto('/quan-tri/tai-khoan')
  const o = page.getByLabel('Tìm tài khoản')
  const s = page.getByLabel('Lọc theo vai trò')
  await expect(o).toBeVisible()

  const [ro, rs] = [await o.boundingBox(), await s.boundingBox()]
  expect(Math.abs(ro!.y - rs!.y), 'ô tìm và bộ lọc phải cùng hàng').toBeLessThan(4)
  expect(rs!.width, 'bộ lọc không được giãn hết hàng').toBeLessThan(ro!.width)

  const pr = await s.evaluate((e) => parseFloat(getComputedStyle(e).paddingRight))
  expect(pr, 'mũi tên select cần chỗ, không để chữ chạy sát').toBeGreaterThanOrEqual(24)
})
