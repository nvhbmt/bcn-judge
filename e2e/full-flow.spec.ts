/**
 * Một lượt đi HẾT chuỗi, từ lúc admin mở khoá tới lúc người học mới tinh nhận AC.
 *
 * Các spec khác cắt hệ thống theo VAI TRÒ, nên mỗi cái chỉ chứng minh phần của mình
 * chạy được trên dữ liệu seed dựng sẵn. Không cái nào chứng minh rằng một khoá, một
 * bài và một tài khoản do CHÍNH giao diện tạo ra sẽ ăn khớp với nhau — mà đó đúng là
 * việc CLB làm đầu mỗi học kỳ, và là chỗ dễ hỏng nhất vì nó đi qua mọi ranh giới:
 * quản trị → ngân hàng bài → giáo trình → cổng xuất bản → đăng nhập lần đầu → chấm.
 *
 * Đi bằng cách BẤM chứ không gọi API: chuỗi này hỏng ở đâu thì gần như luôn là ở một
 * cái nút không dẫn tới đâu, chứ không phải ở tầng dữ liệu.
 */
import { expect, test, type Page } from '@playwright/test'
import { authFile, submitLogin, waitForVerdict, watchForErrors } from './helpers'

const STAMP = Date.now()
const EMAIL = `e2e-full-${STAMP}@test.local`
const COURSE_CODE = `e2e${STAMP}`
const PROBLEM = `E2E Nhân hai số ${STAMP}`
const MAT_KHAU_MOI = 'MatKhauMoi123!'

/** Lời giải đúng: đọc hai số, in tích. */
const SOLUTION = `#include <stdio.h>
int main(void){ long long a,b; if(scanf("%lld %lld",&a,&b)!=2) return 1; printf("%lld\\n", a*b); return 0; }
`

/** CodeMirror không phải <textarea>, phải gõ qua bàn phím thật. */
async function typeInto(page: Page, index: number, text: string): Promise<void> {
  const editor = page.locator('.cm-content').nth(index)
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText(text)
}

test.describe('Full luồng: admin mở khoá → mentor soạn bài → member mới làm được bài', () => {
  test.describe.configure({ mode: 'serial' })

  let otp = ''
  let courseId = ''

  test('admin cấp tài khoản, mở khoá và ghi danh', async ({ browser }) => {
    const page = await browser.newPage({ storageState: authFile('admin') })
    const { errors } = watchForErrors(page)

    // ── tài khoản ────────────────────────────────────────────────────────────
    await page.goto('/quan-tri/tai-khoan')
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
    await page.getByLabel('Email', { exact: true }).fill(EMAIL)
    await page.getByLabel('Họ và tên').fill('Người học mới')
    await page.getByRole('button', { name: /Tạo tài khoản/ }).last().click()

    // Mật khẩu một lần chỉ hiện đúng ở đây — lấy được nó là điều kiện của cả phần sau.
    // Bám vào chính bảng cảnh báo (`role="alert"` của OneTimeSecret) rồi lấy thẻ <code>
    // bên trong. Quét cả trang bằng regex thì bắt nhầm: lần đầu tôi tóm phải chữ
    // "MemberMentorAdmin" của bộ lọc vai trò, và test đỏ ở tận bước cuối.
    const secretBox = page.getByRole('alert').filter({ hasText: /mật khẩu/i }).first()
    await expect(secretBox).toBeVisible({ timeout: 20_000 })
    otp = ((await secretBox.locator('code').first().textContent()) ?? '').trim()
    expect(otp).toMatch(/^[A-Za-z0-9]{8,}$/)

    // ── khoá học ─────────────────────────────────────────────────────────────
    // Tạo và sửa đều là TRANG RIÊNG, không còn bung ra trong danh sách.
    await page.goto('/quan-tri/khoa-hoc')
    await page.getByRole('link', { name: /Tạo khoá học/ }).click()
    await page.getByLabel('Mã khoá').fill(COURSE_CODE)
    await page.getByLabel('Tên khoá').fill(`Khoá E2E ${STAMP}`)
    await page.getByLabel('Trạng thái').selectOption('open')
    await page.getByRole('button', { name: /Lưu|Tạo/ }).last().click()

    // Lưu xong quay về danh sách, và khoá vừa tạo phải có mặt ở đó.
    await expect(page).toHaveURL(/\/quan-tri\/khoa-hoc$/, { timeout: 20_000 })
    const row = page.getByRole('listitem').filter({ hasText: COURSE_CODE })
    await expect(row).toBeVisible({ timeout: 20_000 })

    // ── ghi danh ─────────────────────────────────────────────────────────────
    // "Sửa" mở màn sửa khoá có TAB; ghi danh là một tab riêng, không phải thứ đầu tiên
    // nhìn thấy. Id đọc từ URL — trước đây phải gọi API vòng qua vì trang khoá mở khoá
    // trong chỗ và URL không đổi.
    await row.getByRole('link', { name: 'Sửa' }).click()
    await expect(page).toHaveURL(/\/mentor\/khoa-hoc\/[0-9a-f-]{36}\/thong-tin$/, { timeout: 20_000 })
    courseId = new URL(page.url()).pathname.split('/')[3] ?? ''
    expect(courseId).toMatch(/^[0-9a-f-]{36}$/)

    await page.getByRole('navigation', { name: 'Phần của khoá học' }).getByRole('link', { name: 'Ghi danh' }).click()

    // Đi đúng đường mặc định của admin bây giờ: GÕ TÌM rồi bấm chọn. Ô dán cả danh
    // sách vẫn còn (US-1) nhưng đã thu sau một nút, và nó có test đơn vị riêng.
    await page.getByLabel('Tìm tài khoản').fill(EMAIL)
    const dong = page.locator('li', { hasText: EMAIL }).filter({ has: page.getByRole('button', { name: 'Ghi danh' }) })
    await dong.first().getByRole('button', { name: 'Ghi danh' }).click()

    // Xuất hiện ở danh sách "Đã ghi danh" bên dưới.
    await expect(page.getByText(EMAIL).first()).toBeVisible({ timeout: 20_000 })
    expect(errors).toEqual([])
    await page.close()
  })

  test('mentor soạn bài, nạp testcase và kiểm bằng lời giải mẫu', async ({ browser }) => {
    const page = await browser.newPage({ storageState: authFile('admin') })
    const { errors } = watchForErrors(page)

    await page.goto('/mentor/bai-tap')
    await page.getByRole('button', { name: 'Bài tập mới' }).click()
    await page.getByLabel('Tiêu đề', { exact: true }).fill(PROBLEM)
    await page.getByRole('button', { name: 'Tạo và soạn' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(PROBLEM)

    // Đề bài là trường bắt buộc của validateForm — bỏ trống thì không lưu được.
    // `getByLabel('Đề bài')` trùng với TAB cùng tên — chỉ đích danh ô nhập.
    await page.getByRole('textbox', { name: 'Đề bài' }).fill('Cho hai số nguyên a và b. In ra tích của chúng.')

    // ── testcase: một mẫu, một ẩn ────────────────────────────────────────────
    await page.getByRole('tab', { name: /Testcase/ }).click()
    await page.getByRole('button', { name: /Thêm testcase/ }).click()
    await page.getByRole('button', { name: /Thêm testcase/ }).click()

    // `exact` ở cả hai: getByLabel khớp CHUỖI CON không phân biệt hoa thường, mà form
    // zip có một checkbox với nhãn dài chứa chữ "expected".
    await page.getByLabel('Input', { exact: true }).first().fill('3 5\n')
    await page.getByLabel('Expected output', { exact: true }).first().fill('15\n')
    await page.getByLabel('Input', { exact: true }).nth(1).fill('-2 7\n')
    await page.getByLabel('Expected output', { exact: true }).nth(1).fill('-14\n')
    await page.getByLabel(/Loại testcase #2/).selectOption('hidden')

    await page.getByRole('button', { name: 'Lưu bảng testcase…' }).click()
    // Ghi testcase đi qua một bước xác nhận vì nó xoá sạch bộ cũ (FR-D4). Khớp theo
    // chữ trong DOM, không phải chữ trên màn hình: nút danger được CSS viết hoa nhưng
    // tên trợ năng vẫn là "Vẫn thay toàn bộ testcase".
    await page.getByRole('button', { name: 'Vẫn thay toàn bộ testcase' }).click()
    await expect(page.getByText(/2 testcase|#2/).first()).toBeVisible({ timeout: 20_000 })

    // ── lời giải mẫu rồi kiểm ────────────────────────────────────────────────
    // Ô lời giải nằm trong tab riêng từ khi trình soạn chia tab theo nhịp sửa —
    // cùng bản vá với mentor.spec.ts, chuỗi này serial nên sót là sập cả dây.
    await page.getByRole('tab', { name: 'Lời giải' }).click()
    await page.getByLabel('Ngôn ngữ của lời giải').selectOption('c11')
    await typeInto(page, 0, SOLUTION)
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await expect(page.getByText(/Đã lưu|đã lưu/).first()).toBeVisible({ timeout: 20_000 })

    // Nút kiểm nằm ở BƯỚC 3 của thẻ Testcase, không còn ở băng cố định dưới thanh
    // tiêu đề — nên phải quay lại thẻ đó. Đổi lại, ba bước của US-2 nằm liền nhau.
    await page.getByRole('tab', { name: /Testcase/ }).click()
    await page.getByRole('button', { name: 'Kiểm tra bằng lời giải mẫu' }).click()
    // Cổng xuất bản FR-D6: bài chỉ "Đã kiểm" khi lời giải mẫu chạy đúng toàn bộ test.
    await expect(page.getByText('Đã kiểm').first()).toBeVisible({ timeout: 90_000 })
    expect(errors).toEqual([])
    await page.close()
  })

  test('gắn bài vào giáo trình và xuất bản', async ({ browser }) => {
    const page = await browser.newPage({ storageState: authFile('admin') })
    const { errors } = watchForErrors(page)

    await page.goto(`/mentor/khoa-hoc/${courseId}/thong-tin`)
    await page.getByLabel('Chương mới').fill('Chương 1 — E2E')
    await page.getByRole('button', { name: 'Tạo chương' }).click()
    await expect(page.getByText('Chương 1 — E2E').first()).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: /Thêm mục/ }).first().click()
    await page.getByLabel('Loại mục').selectOption('problem')
    // Nhãn option có đuôi trạng thái ("… — 2 testcase, đã kiểm") nên không khớp
    // `{ label }` được; lấy value của option bắt đầu bằng tên bài rồi chọn theo value.
    const bank = page.getByLabel('Bài tập từ ngân hàng')
    const problemValue = await bank.locator('option', { hasText: PROBLEM }).getAttribute('value')
    expect(problemValue).toBeTruthy()
    await bank.selectOption(problemValue!)
    await page.getByLabel('Tên mục').fill(PROBLEM)
    await page.getByRole('button', { name: 'Thêm mục' }).last().click()

    await expect(page.getByText(PROBLEM).first()).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Xuất bản', exact: true }).first().click()
    await expect(page.getByText('Xuất bản').first()).toBeVisible({ timeout: 20_000 })
    expect(errors).toEqual([])
    await page.close()
  })

  test('member mới: đăng nhập lần đầu, đổi mật khẩu, làm bài và nhận AC', async ({ browser }) => {
    // Ngữ cảnh SẠCH — không nạp storageState của ai. Đây là người dùng thật sự mới.
    const page = await browser.newPage()
    const { errors } = watchForErrors(page)

    // Qua `submitLogin` để chịu được giới hạn 10 lần/phút/IP: chạy cả bộ E2E thì spec
    // này gần như luôn là cú đăng nhập vượt ngưỡng, và lúc đó màn hình báo "Thử lại
    // sau N giây" chứ không phải sai mật khẩu.
    await submitLogin(page, EMAIL, otp)

    // FR-A2: mật khẩu admin cấp phải đổi trước khi dùng được gì.
    await expect(page).toHaveURL(/doi-mat-khau/, { timeout: 20_000 })
    await page.getByLabel('Mật khẩu hiện tại').fill(otp)
    await page.getByLabel('Mật khẩu mới (tối thiểu 8 ký tự)').fill(MAT_KHAU_MOI)
    await page.getByLabel('Nhập lại mật khẩu mới').fill(MAT_KHAU_MOI)
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click()

    // Khoá vừa ghi danh phải có mặt ở trang chủ.
    await expect(page.getByText(COURSE_CODE).first()).toBeVisible({ timeout: 30_000 })
    await page.getByText(COURSE_CODE).first().click()
    await page.getByText(PROBLEM).first().click()

    await expect(page.getByRole('heading', { level: 1 })).toContainText(PROBLEM)
    await typeInto(page, 0, SOLUTION)
    await page.getByRole('button', { name: 'Nộp bài' }).click()
    expect(await waitForVerdict(page)).toBe('AC')
    expect(errors).toEqual([])
    await page.close()
  })
})
