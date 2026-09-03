/**
 * Con trỏ trên những thứ bấm được.
 *
 * Preflight của Tailwind v4 bỏ `cursor: pointer` mặc định của <button> (v3 có), nên cả
 * app trỏ mũi tên trên MỌI nút — nút và chữ thường trông giống hệt nhau cho tới lúc bấm
 * thử. Luật ở `design-system/tokens/base.css` trả lại tín hiệu đó.
 *
 * Kiểm bằng trình duyệt thật chứ không đọc file CSS: luật này sống hay chết là chuyện
 * của cascade (base thua utilities, `:has()` có thể bị trình duyệt vứt cả luật), mà chỉ
 * `getComputedStyle` mới trả lời được. Và quét TẤT CẢ nút trên trang, không lấy mẫu một
 * cái — một nút lẻ đặt `cursor-default` cũng phải lộ ra.
 */
import { expect, test } from '@playwright/test'
import { authFile } from './helpers'

/** Nút nào lệch so với kỳ vọng: tắt thì `not-allowed`, còn lại `pointer`. */
async function lech(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => {
        const mong = (el as HTMLButtonElement).disabled ? 'not-allowed' : 'pointer'
        const that = getComputedStyle(el).cursor
        return that === mong ? null : `${(el.textContent || '(không chữ)').trim().slice(0, 30)} → ${that}`
      })
      .filter((v): v is string => v !== null),
  )
}

test.describe('member', () => {
  test.use({ storageState: authFile('member') })

  test('mọi nút trên trang chủ đều có con trỏ bàn tay', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button').first()).toBeVisible()
    expect(await lech(page)).toEqual([])
  })

  test('cả nút trong màn làm bài — kể cả dải tab và ô chọn ngôn ngữ', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /C cơ bản/ }).click()
    await page.getByRole('link', { name: 'Tổng hai số' }).first().click()
    await page.locator('.cm-content').waitFor()

    expect(await lech(page)).toEqual([])
    // <select> cũng mất bàn tay ở v4, mà đây là chỗ đổi ngôn ngữ — bấm nhiều.
    await expect(page.locator('select').first()).toHaveCSS('cursor', 'pointer')
  })

  test('<select> và <option> có nền THẬT, không trong suốt', async ({ page }) => {
    // Preflight của Tailwind đặt `background-color: transparent` cho form control.
    // Bảng chọn xổ xuống do TRÌNH DUYỆT vẽ và nó lấy màu nền của thẻ select — trong
    // suốt thì Chrome rơi về nền trắng mặc định, trong khi chữ vẫn là mực sáng của
    // theme, nên ở nền tối bảng chọn thành chữ nhạt trên nền trắng.
    //
    // `color-scheme: dark` KHÔNG cứu được ca này (đã đo: nó áp đúng mà bảng vẫn
    // trắng) — nó chỉ quyết định khi control còn dùng màu mặc định của trình duyệt.
    // Kiểm ở CẢ HAI theme vì nền trong suốt hỏng câm ở bản tối, còn bản sáng thì
    // trùng màu nên không ai thấy.
    await page.goto('/')
    await page.getByRole('link', { name: /C cơ bản/ }).click()
    await page.getByRole('link', { name: 'Tổng hai số' }).first().click()
    await page.locator('.cm-content').waitFor()

    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t
      }, theme)
      const o = page.locator('select[aria-label="Ngôn ngữ"] option').first()
      const nen = await o.evaluate((e) => getComputedStyle(e).backgroundColor)
      expect(nen, `theme ${theme}: nền option`).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/)

      // Mũi tên xổ xuống do HỆ THIẾT KẾ vẽ (appearance: none), nên nó phải có khoảng
      // cách với mép — mũi tên mặc định của trình duyệt dính sát ~6px và `padding`
      // không đẩy được nó. Và ô phải chừa đủ chỗ để chữ không chui xuống dưới nó.
      const s = page.locator('select[aria-label="Ngôn ngữ"]')
      const kieu = await s.evaluate((e) => {
        const cs = getComputedStyle(e)
        return { appearance: cs.appearance, anh: cs.backgroundImage, pr: parseFloat(cs.paddingRight) }
      })
      expect(kieu.appearance, `theme ${theme}`).toBe('none')
      expect(kieu.anh, `theme ${theme}: phải có mũi tên tự vẽ`).toContain('svg')
      expect(kieu.pr, `theme ${theme}: chữ sẽ chui xuống dưới mũi tên`).toBeGreaterThanOrEqual(24)
    }
  })
})

test.describe('admin', () => {
  test.use({ storageState: authFile('admin') })

  test('ô tick và nhãn của nó cùng có bàn tay, nhãn ô chữ thì không', async ({ page }) => {
    await page.goto('/quan-tri/cai-dat')
    const tick = page.locator('input[type="checkbox"]').first()
    await expect(tick).toBeVisible()
    await expect(tick).toHaveCSS('cursor', 'pointer')
    // Bấm vào chữ cũng tick, nên chữ cũng phải báo là bấm được.
    await expect(page.locator('label:has(input[type="checkbox"])').first()).toHaveCSS('cursor', 'pointer')

    // Và luật KHÔNG được quét quá tay: nhãn của ô nhập chữ bấm vào chỉ đặt con nháy,
    // không phải một hành động — để bàn tay ở đó là hứa nhầm.
    await expect(page.locator('label:has(input[type="number"])').first()).toHaveCSS('cursor', 'default')

    // Nút đang tắt nói rõ là đang tắt, không im lặng trông như bấm được.
    const tat = page.getByRole('button', { name: 'Chưa có thay đổi' })
    if (await tat.count()) await expect(tat).toHaveCSS('cursor', 'not-allowed')
  })
})
