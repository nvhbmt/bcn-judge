/**
 * Luồng của member: trang chủ → khoá → bài → gõ code → chạy thử → nộp → verdict.
 *
 * Đây là luồng đắt nhất nhưng cũng là lý do hệ thống tồn tại. Nộp bài đi qua hàng
 * đợi Postgres, worker và container Docker thật, nên các test ở đây chậm hơn hẳn
 * phần còn lại — đó là cái giá của việc kiểm THẬT thay vì mock.
 */
import { expect, test, type Page } from '@playwright/test'
import { authFile, nhanVerdict, waitForVerdict, watchForErrors } from './helpers'

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

  /*
   * Bôi đen một dòng phải THẤY được vệt chọn, kể cả trên chính dòng đang gõ.
   *
   * Hai cách hỏng, và chỉ trình duyệt thật bắt được cách thứ hai:
   *   1. vùng chọn dùng chung `--surface-sel` với dòng đang gõ → cùng màu, vô hình;
   *   2. rule ngắn hơn baseTheme của CodeMirror (5 lớp) thua độ đặc hiệu, nên màu
   *      lặng lẽ giữ nguyên #d7d4f0 mặc định — nguồn trông đúng mà màn hình thì sai.
   */
  await page.locator('.cm-content').click()
  await page.keyboard.insertText('int main(void) { return 0; }')
  await page.keyboard.press('ControlOrMeta+a')
  // CodeMirror vẽ lớp chọn ở nhịp sau, nên phải chờ nó có mặt rồi mới đo màu.
  await expect(page.locator('.cm-selectionBackground').first()).toBeVisible()
  const mauChon = await page.evaluate(() => {
    const e = document.querySelector('.cm-selectionBackground')
    return e ? getComputedStyle(e).backgroundColor : null
  })
  expect(mauChon, 'không có lớp vùng chọn nào được vẽ').not.toBeNull()
  expect(mauChon).toContain('oklch')
  expect(mauChon).not.toContain('215, 212, 240')
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

  await rail.getByRole('button', { name: 'Thống kê' }).click()
  await expect(page.getByText(/Lượt nộp|Chưa ai nộp/).first()).toBeVisible()

  await rail.getByRole('button', { name: 'Lời giải' }).click()
  await expect(page.getByText(/Lời giải của mọi người|Giải được bài này|Contest đang diễn ra/).first()).toBeVisible()

  // Bản v2 gộp về MỘT lớp tab: "Đề bài" và "Bài nộp" nay cũng là icon trên rail, nên
  // mục đưa về đề bài đổi tên từ "Mô tả" thành "Đề bài" (pages/workspace/rail.tsx).
  await rail.getByRole('button', { name: 'Đề bài' }).click()
  await expect(page.getByRole('heading', { name: 'Tổng hai số' })).toBeVisible()
})

test('bài đọc trong giáo trình mở và dựng được nội dung', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/')
  await page.getByRole('link', { name: /C cơ bản/ }).click()

  // Mục loại `lesson` trước đây không có đường hiển thị nào: cả hai danh sách giáo
  // trình đều trỏ nó vào màn làm bài, mà màn đó hỏi /api/member/problems và nhận 404.
  // Nên bấm vào một bài đọc chỉ ra khung trống, còn log thì đầy 404.
  await page.getByRole('link', { name: 'Đọc và ghi dữ liệu chuẩn' }).first().click()

  await expect(page.getByRole('heading', { level: 1, name: 'Đọc và ghi dữ liệu chuẩn' })).toBeVisible()
  await expect(page.getByText(/Chương trình trên hệ thống chấm/)).toBeVisible()
  // Markdown dựng thật: khối code và công thức KaTeX trong thân bài đều lên hình.
  await expect(page.locator('pre code').first()).toContainText('scanf')
  await expect(page.locator('.katex').first()).toBeVisible()

  // Không có gì để gõ thì không dựng khung code — và cũng không có mục "Bài nộp".
  await expect(page.locator('.cm-content')).toHaveCount(0)
  const rail = page.getByRole('navigation').filter({ hasNot: page.getByText('~/khoá-học') })
  await expect(rail.getByRole('button', { name: 'Bài nộp' })).toHaveCount(0)

  // Đọc xong phải đi tiếp được, nếu không là mắc kẹt ở trang lý thuyết.
  await page.getByRole('link', { name: 'bài sau →' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Tổng hai số' })).toBeVisible()
  await expect(page.locator('.cm-content')).toBeVisible()

  expect(errors).toEqual([])
})

test('chạy thử trên testcase mẫu, không tính vào lịch sử nộp (FR-F1)', async ({ page }) => {
  await page.goto('/')
  await openFirstProblem(page)
  await typeCode(page, AC_SOURCE)

  await page.getByRole('button', { name: 'Chạy thử' }).click()

  // Bám vào chính BẢNG kết quả, không phải vào một con số nào đó có trên màn hình:
  // bản trước khẳng định "thấy chữ 8" trong khi 8 đã nằm sẵn ở khối ví dụ của đề từ
  // trước lúc bấm, nên nó xanh kể cả khi nút Chạy thử không làm gì cả.
  const console_ = page.getByRole('tablist', { name: 'Bảng điều khiển' })
  await expect(console_.getByRole('tab', { name: 'chạy thử' })).toHaveAttribute('aria-selected', 'true')

  // Chip của test #1 mang đủ ba tin trong nhãn trợ năng: số test, mẫu hay ẩn, verdict.
  // Trên màn hình hai tin sau nằm ở màu và nét viền — thứ không đọc thành lời được.
  const chip = page.getByRole('tab', { name: /^Test 1,/ })
  await expect(chip).toBeVisible({ timeout: 60_000 })
  await expect(chip).toHaveAccessibleName(`Test 1, mẫu, ${nhanVerdict('AC')}`)
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

  // Cả hai testcase mẫu đều sai, nhưng chỉ MỘT bảng so được mở — bảng của test sai đầu
  // tiên, tức #1. Vẫn gọi đích danh bằng tên trợ năng: nếu mặc định trôi sang test khác
  // thì test này phải đỏ, chứ không được lặng lẽ soi nhầm bảng.
  const diff = page.getByRole('group', { name: 'So output testcase mẫu #1' })
  await expect(diff).toBeVisible({ timeout: 60_000 })
  await expect(diff.getByText('khác từ dòng 1')).toBeVisible()
  await expect(diff.getByText('output của bạn')).toBeVisible()
  await expect(diff.getByText('đáp án đúng')).toBeVisible()

  // 3 - 5 = -2, đáp án đúng là 8: khoảng được tô phải đúng bằng hai giá trị đó chứ
  // không phải cả dòng. Đây mới là thứ chứng minh phần tô sáng chạy thật.
  await expect(diff.locator('mark')).toHaveText(['-2', '8'])
})

test('verdict về qua SSE, không phải chờ đường lùi polling (FR-F4)', async ({ page }) => {
  await page.goto('/')
  await openFirstProblem(page)
  await typeCode(page, AC_SOURCE)

  // Chốt thời gian, vì đây là một lỗi CÂM. Máy chủ gửi sự kiện SSE có tên, mà bản cũ
  // chỉ gắn `EventSource.onmessage` — thứ chỉ nổ với sự kiện không tên — nên trình
  // duyệt không nhận được gì. Không ai phát hiện suốt thời gian dài vì đường lùi
  // polling vẫn đưa verdict về, chỉ chậm hơn hẳn.
  //
  // Đường lùi KHÔNG THỂ nhanh hơn 6 giây (4 giây chờ ân hạn + một nhịp poll 2 giây),
  // nên mốc 4,5 giây ở đây phân biệt được hai đường mà vẫn thừa chỗ cho một lượt chấm
  // chậm gấp mấy lần bình thường (~600 ms).
  const t0 = Date.now()
  await page.getByRole('button', { name: 'Nộp bài' }).click()
  await page.waitForResponse(
    async (res) =>
      /\/api\/member\/submissions\/[0-9a-f-]{36}$/.test(new URL(res.url()).pathname) &&
      res.ok() &&
      (await res.json().catch(() => null))?.data?.status === 'done',
    { timeout: 60_000 },
  )
  expect(Date.now() - t0).toBeLessThan(4_500)
})

test('nộp bài đúng → AC, nộp bài sai → WA, cả hai vào lịch sử', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/')
  await openFirstProblem(page)

  await typeCode(page, AC_SOURCE)
  await page.getByRole('button', { name: 'Nộp bài' }).click()
  expect(await waitForVerdict(page)).toBe('AC')
  // Nộp đúng nay bật hộp thoại mừng AC che nút Nộp — đóng nó bằng "Ở lại" rồi mới
  // nộp lần sau. (Hộp thoại có ca riêng ngay dưới.)
  await page.getByRole('button', { name: 'Ở lại' }).click()

  await typeCode(page, WA_SOURCE)
  await page.getByRole('button', { name: 'Nộp bài' }).click()
  await expect(async () => {
    expect(await waitForVerdict(page)).toBe('WA')
  }).toPass({ timeout: 60_000 })

  // "Bài nộp" phải thấy cả hai lần. Bản v2 gộp về một lớp tab nên nó là một icon trên
  // rail chứ không còn là tab riêng dưới khung nội dung.
  const rail = page.getByRole('navigation').filter({ hasNot: page.getByText('~/khoá-học') })
  await rail.getByRole('button', { name: 'Bài nộp' }).click()
  await expect(page.getByText(nhanVerdict('AC'), { exact: true }).first()).toBeVisible()
  await expect(page.getByText(nhanVerdict('WA'), { exact: true }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('nộp AC bật hộp thoại → "Làm bài tiếp" sang đúng bài kề sau (yêu cầu người dùng)', async ({ page }) => {
  await page.goto('/')
  await openFirstProblem(page) // Tổng hai số — bài kề sau là "Ước chung lớn nhất"

  await typeCode(page, AC_SOURCE)
  await page.getByRole('button', { name: 'Nộp bài' }).click()
  expect(await waitForVerdict(page)).toBe('AC')

  // Hộp thoại mừng AC hiện, hỏi đi tiếp hay ở lại.
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('link', { name: /Làm bài tiếp/ }).click()

  // Sang đúng bài kề sau, và hộp thoại biến mất.
  await expect(page.getByRole('heading', { name: 'Ước chung lớn nhất' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('nộp AC rồi bấm "Ở lại" thì ở nguyên bài, xem lại kết quả', async ({ page }) => {
  await page.goto('/')
  await openFirstProblem(page)
  await typeCode(page, AC_SOURCE)
  await page.getByRole('button', { name: 'Nộp bài' }).click()
  expect(await waitForVerdict(page)).toBe('AC')

  await page.getByRole('dialog').getByRole('button', { name: 'Ở lại' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Tổng hai số' })).toBeVisible()
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

  // Bấm TIẾP vào một bài, không dừng ở trang chi tiết. Bước này từng thiếu, và đúng
  // chỗ thiếu đó lọt một TypeError giết cả màn làm bài: trang contest ghi cache
  // `['contest', id]` dưới dạng phong bì, màn làm bài đọc ra lại tưởng đã bóc. Vào
  // thẳng bằng URL nguội thì không lỗi — chỉ ĐI TỪ trang contest mới lộ, nên cú bấm
  // này là thứ duy nhất bắt được nó.
  await page.getByRole('link', { name: /Bài|Tổng|Đếm|Chuỗi/ }).first().click()
  await expect(page).toHaveURL(/\/contest\/[^/]+\/bai\/[^/]+/)
  // Có đề và có chỗ gõ code thì màn làm bài đã dựng xong, không phải trang trắng.
  await expect(page.getByRole('button', { name: /Nộp bài/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('BXH các team hiện ĐỦ tên — cột tên không bị bóp khi bảng không còn hàng tiêu đề', async ({ page }) => {
  // Hồi quy có thật: bỏ <thead> theo bản vẽ làm các class bề rộng sống trên <th>
  // biến mất, cột tên (max-w-0 + truncate) co còn vài ký tự — "Chuột …" giữa một
  // hàng trống trơn. jsdom không có layout nên chỉ đo được ở đây.
  await page.goto('/team')
  const oTen = page.locator('table td:nth-child(2)').first()
  await expect(oTen).toBeVisible()
  const bi_cat = await oTen.evaluate((el) => el.scrollWidth > el.clientWidth)
  expect(bi_cat, 'tên team bị cắt dù bảng còn thừa chỗ').toBe(false)
})

test('leader: danh sách thành viên → trang riêng hai panel (FR-J)', async ({ page }) => {
  const { errors } = watchForErrors(page)
  await page.goto('/')

  await page.getByRole('link', { name: '~/team' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Nhóm')

  // Danh sách MỘT dòng mỗi người, và dòng đó là liên kết. Bản trước đổ ra một bảng
  // một dòng mỗi cặp (người × khoá) rồi mới mời bấm, ở tận đáy trang.
  const dong = page.locator('main a[href^="/team/thanh-vien/"]')
  await expect(dong.first()).toBeVisible()
  const soNguoi = await dong.count()
  await dong.first().click()

  // Trang riêng: panel trái chọn người + chọn lượt nộp, panel phải là chi tiết.
  await expect(page).toHaveURL(/\/team\/thanh-vien\/[0-9a-f-]{36}/)
  const chuyen = page.getByRole('navigation', { name: 'Chuyển thành viên' })
  await expect(chuyen.getByRole('link')).toHaveCount(soNguoi)
  await expect(chuyen.locator('[aria-current="page"]')).toBeVisible()

  // Đổi người bằng thanh chuyển: URL đổi, và người đang xem đổi theo.
  if (soNguoi > 1) {
    const truoc = page.url()
    await chuyen.getByRole('link').nth(1).click()
    await expect(page).not.toHaveURL(truoc)
    await expect(chuyen.locator('[aria-current="page"]')).toBeVisible()
  }

  expect(errors).toEqual([])
})

test('mobile: thanh icon cố định ở ĐÁY, không cuộn theo nội dung, header gọn', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 }) // cỡ điện thoại
  await page.goto('/')
  await openFirstProblem(page) // rail chỉ sống trong khu làm bài
  // KHÔNG đòi .cm-content hiện: trên mobile editor nằm trong tab "Code" đang ẩn,
  // mặc định mở tab Nội dung — đó là đúng hành vi FR-E9, không phải lỗi.
  const rail = page.getByTestId('icon-rail')
  await expect(rail).toBeVisible()

  const vh = page.viewportSize()!.height
  const box = await rail.boundingBox()
  // Dính đáy: mép dưới của rail chạm mép dưới viewport (sai số 1px).
  expect(Math.abs((box!.y + box!.height) - vh), 'rail phải chạm đáy màn hình').toBeLessThanOrEqual(1)
  // Thanh ngang, không phải cột dọc: rộng gần hết màn, cao một hàng icon.
  expect(box!.width).toBeGreaterThan(page.viewportSize()!.width * 0.8)
  expect(box!.height).toBeLessThan(80)

  // position:fixed — cuộn nội dung thì rail đứng yên.
  const posBefore = (await rail.boundingBox())!.y
  await page.mouse.wheel(0, 400)
  await page.waitForTimeout(150)
  const posAfter = (await rail.boundingBox())!.y
  expect(Math.abs(posAfter - posBefore), 'rail không được cuộn theo nội dung').toBeLessThanOrEqual(1)
})
