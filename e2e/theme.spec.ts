/**
 * Đổi theme sáng/tối.
 *
 * Dùng phiên nạp sẵn chứ không tự đăng nhập: `/auth/login` chặn 10 lần mỗi phút
 * mỗi IP, và test này không kiểm luồng đăng nhập nên không nên tiêu hạn mức đó.
 */
import { expect, test } from '@playwright/test'
import { authFile, theme } from './helpers'

test.use({ storageState: authFile('member') })

/**
 * Nút đổi theme nay nằm trong menu tài khoản — mở menu rồi mới bấm được.
 *
 * Giả định menu đang ĐÓNG. Bấm mục đổi theme cố ý KHÔNG đóng menu (xem UserMenu: để
 * so hai bản không phải mở lại từ đầu), nên gọi hàm này hai lần liên tiếp thì cú bấm
 * nút của lần hai lại chính là cú bấm ĐÓNG menu, và mục cần tìm không bao giờ hiện.
 * Muốn đổi tiếp thì bấm thẳng vào mục, hoặc tải lại trang trước.
 */
async function doiTheme(page: import('@playwright/test').Page, sang: 'tối' | 'sáng') {
  await page.locator('header button[aria-haspopup="menu"]').click()
  await page.getByRole('menuitem', { name: `Nền ${sang}` }).click()
}

test('đổi theme và nhớ lại sau khi tải lại trang', async ({ page }) => {
  await page.goto('/')
  expect(await theme(page)).toBe('light')

  await doiTheme(page, 'tối')
  expect(await theme(page)).toBe('dark')

  // Nhớ qua lần tải lại, và đặt TRƯỚC lần vẽ đầu nên không chớp sáng.
  await page.reload()
  expect(await theme(page)).toBe('dark')

  await doiTheme(page, 'sáng')
  expect(await theme(page)).toBe('light')
})

/**
 * Thanh cuộn, ô tick và bảng chọn của <select> do TRÌNH DUYỆT vẽ, không phải CSS của
 * mình. Trước đây `color-scheme` không được khai ở đâu cả, nên chúng luôn ở bảng màu
 * sáng: nền tối mà thanh cuộn vẫn trắng, chạy dọc suốt màn hình.
 *
 * Kiểm bằng giá trị TÍNH ĐƯỢC trên <html> chứ không chụp ảnh thanh cuộn: macOS dùng
 * thanh cuộn phủ rộng 0px nên ảnh chụp không có gì để so, còn `color-scheme` mới là
 * thứ quyết định màu ấy trên mọi hệ.
 */
test('color-scheme đi theo theme, không để trình duyệt tự đoán', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')

  await doiTheme(page, 'tối')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')

  // Và nhớ qua lần tải lại, cùng nhịp với token màu — không được lệch nhau một nhịp,
  // vì lệch thì có một khoảnh khắc nền tối mà thanh cuộn còn sáng.
  await page.reload()
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
})

/**
 * Chữ nhấn mạnh (<b>, <strong>) ở nền TỐI phải sáng hơn câu quanh nó.
 *
 * Riêng nét đậm là không đủ trên nền tối: chữ sáng bị "nở" nên khoảng cách 400 → 600
 * mà mắt thấy hẹp hơn hẳn so với nền kem, cụm được nhấn chìm vào câu.
 *
 * Chỉ kiểm được ở TRÌNH DUYỆT THẬT: luật dùng `oklch(from currentColor …)`, tức màu
 * phụ thuộc giá trị thừa kế tại chỗ — jsdom không dựng cascade nên ở đó không có gì
 * để đo. Đo cả hai theme trong một test để bắt được ca "nâng cả ở nền sáng".
 */
test('nền tối: chữ nhấn mạnh sáng hơn câu, nền sáng thì giữ nguyên', async ({ page }) => {
  await page.goto('/')

  const doSang = async () =>
    page.evaluate(() => {
      // Dựng ngay trên trang thật để lấy đúng token và đúng cascade đang chạy.
      const p = document.createElement('p')
      p.style.color = 'var(--ink-3)'
      p.innerHTML = 'thường <strong>đậm</strong>'
      document.body.append(p)
      // Đổi màu qua canvas chứ KHÔNG tự đọc chuỗi: màu tính được ở đây trả về nguyên
      // dạng `oklch(...)` vì luật dùng cú pháp màu tương đối, và đọc ba số đầu của nó
      // như thể r,g,b thì ra một con số vô nghĩa mà test vẫn chạy — đã dính đúng bẫy
      // này một lần. Canvas nhận mọi dạng màu trình duyệt hiểu và trả về byte sRGB.
      const ctx = document.createElement('canvas').getContext('2d')!
      const L = (el: Element) => {
        ctx.fillStyle = getComputedStyle(el).color
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b] = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => {
          const c = v / 255
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
      }
      const ra = { cau: L(p), dam: L(p.querySelector('strong')!) }
      p.remove()
      return ra
    })

  // Nền sáng đo TRƯỚC vì đó là mặc định: giữ cả bài test ở đúng một lần đổi theme.
  // Nền sáng vốn đã rõ nhờ nét đậm — nâng thêm ở đây là sửa thứ không hỏng.
  const sang = await doSang()
  expect(sang.dam).toBeCloseTo(sang.cau, 5)

  await doiTheme(page, 'tối')
  const toi = await doSang()
  expect(toi.dam).toBeGreaterThan(toi.cau * 1.2)
})

/**
 * Nhấn mạnh phải xin đúng một mặt chữ CÓ TẢI.
 *
 * `<b>` mặc định là 700, mà <link> font chỉ xin tới 600 cho IBM Plex Sans — xin nét
 * không có thì trình duyệt lấy mặt gần nhất rồi có thể tự bôi cho dày, tức làm nhoè.
 * Luật này canh hai file khớp nhau: sửa một bên mà quên bên kia là đỏ.
 */
test('nét chữ đậm nằm trong danh sách font đã tải', async ({ page }) => {
  await page.goto('/')
  const netXin = await page.evaluate(() => {
    const p = document.createElement('p')
    p.innerHTML = '<strong>x</strong>'
    document.body.append(p)
    const w = getComputedStyle(p.querySelector('strong')!).fontWeight
    p.remove()
    return w
  })
  const link = await page.locator('link[href*="IBM+Plex+Sans"]').first().getAttribute('href')
  const net = /IBM\+Plex\+Sans:wght@([\d;]+)/.exec(link ?? '')?.[1]?.split(';') ?? []
  expect(net).toContain(netXin)
})

test('SectionRule tô moss ở CẢ HAI theme — không kẹt lại mực trung tính', async ({ page }) => {
  // Người dùng từng bắt được: bản tối nhãn vẫn #9e9481 (ink-6). Đo COMPUTED color
  // của chính nhãn và so với --moss đã phân giải ở :root — kiểm tầng cascade thật,
  // thứ jsdom không có.
  await page.goto('/')
  const nhan = page.locator('.rule-ink').first()
  await expect(nhan).toBeVisible()

  const mauNhan = async () => nhan.evaluate((el) => getComputedStyle(el).color)
  const mauMoss = async () =>
    page.evaluate(() => {
      const d = document.createElement('div')
      d.style.color = 'var(--moss)'
      document.body.append(d)
      const c = getComputedStyle(d).color
      d.remove()
      return c
    })

  expect(await mauNhan(), 'bản sáng: nhãn SectionRule phải là moss').toBe(await mauMoss())

  await doiTheme(page, 'tối')
  expect(await mauNhan(), 'bản tối: nhãn SectionRule phải là moss').toBe(await mauMoss())
})
