/**
 * Ngưỡng tương phản của điểm nhấn bản sáng — đọc THẲNG từ token, không phải bản chép.
 *
 * Vì sao cần: bản sáng từng bị "hoà tan" không phải do thiếu tương phản (đo ra nó còn
 * hơn bản tối ở mọi chỉ số) mà do HƯỚNG — màu điểm tối hơn nền nên mắt đọc ra là mực,
 * không phải điểm nhấn. Cách chữa là tăng DIỆN TÍCH màu, và diện tích thì kéo theo một
 * ràng buộc mới: chữ nằm TRÊN mảng màu đó phải còn đọc được.
 *
 * Ba con số dưới đây là chỗ dễ trôi nhất khi ai đó chỉnh màu cho "đẹp hơn":
 *   - băng cảnh báo nổi ≥ 1.4:1 so với nền (trước khi sửa chỉ 1.16 — gần như tàng hình);
 *   - chữ trên mọi nền đặc và nền wash ≥ 4.5:1 (chữ huy hiệu là 11px, tức chữ nhỏ);
 *   - tint-earth là chỗ chật nhất: earth là màu sáng nhất trong ba nên nền earth đậm
 *     thêm một nấc là chữ earth trên nó rơi xuống dưới ngưỡng.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Đường dẫn từ gốc dự án, không phải import.meta.url: vitest chạy trong jsdom nên
// import.meta.url là URL http của Vite, readFileSync không nhận.
const CSS = readFileSync(resolve(process.cwd(), 'design-system/tokens/colors.css'), 'utf8')

/** Khối `[data-theme='light']` — bản sáng ghi đè, nên phải đọc đúng khối đó. */
const LIGHT = CSS.slice(CSS.indexOf("[data-theme='light']"))

function token(name: string): string {
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(LIGHT)
  if (!m) throw new Error(`Không thấy token --${name} trong khối bản sáng`)
  return m[1]!.trim()
}

type RGB = [number, number, number]

function oklchToRgb(L: number, C: number, h: number): RGB {
  const hr = (h * Math.PI) / 180
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return lin.map((v) => {
    const x = Math.min(1, Math.max(0, v))
    return x > 0.0031308 ? 1.055 * x ** (1 / 2.4) - 0.055 : 12.92 * x
  }) as RGB
}

/** Đọc được cả `#rrggbb` lẫn `oklch(L C H)` — hai dạng token file đang dùng. */
function parse(value: string): RGB {
  const hex = /^#([0-9a-f]{6})$/i.exec(value)
  if (hex) {
    const n = parseInt(hex[1]!, 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  }
  const ok = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value)
  if (!ok) throw new Error(`Không đọc được màu: ${value}`)
  return oklchToRgb(Number(ok[1]), Number(ok[2]), Number(ok[3]))
}

const channel = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminance = ([r, g, b]: RGB) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(parse(a)), luminance(parse(b))]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const BG = () => token('surface-0')

describe('bản sáng — nền mang màu phải nổi lên', () => {
  it.each([
    ['primary-soft', 1.4],
    ['tint-earth', 1.4],
    ['tint-clay', 1.4],
  ])('%s nổi ≥ %s:1 so với nền trang', (name, min) => {
    expect(contrast(token(name), BG())).toBeGreaterThanOrEqual(min)
  })

  it('primary-soft phải CÓ SẮC, không phải be trung tính', () => {
    // Đây đúng là lỗi cũ: --color-primary-soft trỏ vào --surface-sel (chroma 0), nên
    // mọi trạng thái "đang chọn" ở bản sáng không có màu nào cả.
    expect(token('primary-soft')).toMatch(/oklch/)
    expect(token('primary-soft')).not.toBe(token('surface-sel'))
  })
})

describe('bản sáng — chữ trên mảng màu phải đọc được', () => {
  it.each([['moss'], ['earth'], ['clay'], ['brass']])(
    'huy hiệu ĐẶC: chữ on-accent trên nền %s ≥ 4.5:1',
    (accent) => {
      expect(contrast(token('on-accent'), token(accent))).toBeGreaterThanOrEqual(4.5)
    },
  )

  it.each([
    ['moss', 'primary-soft'],
    ['earth', 'tint-earth'],
    ['clay', 'tint-clay'],
  ])('huy hiệu MỀM: chữ %s trên wash %s ≥ 4.5:1', (accent, wash) => {
    expect(contrast(token(accent), token(wash))).toBeGreaterThanOrEqual(4.5)
  })

  it('chữ chính vẫn đọc được trên mọi nền mang màu', () => {
    for (const wash of ['primary-soft', 'tint-earth', 'tint-clay']) {
      expect(contrast(token('ink-2'), token(wash))).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('bảng màu verdict', () => {
  it('CE không còn xám: cùng màu ở huy hiệu và ở log hoạt động', () => {
    // Trước đây --verdict-ce là ink-4 còn VERDICT_TONE.CE là 'wa' — cùng một verdict
    // ra hai màu tuỳ nhìn chỗ nào, dù chú thích ở cả hai file đều ghi "ánh xạ 1:1".
    expect(/--verdict-ce:\s*var\(--clay\)/.test(CSS)).toBe(true)
  })

  it('mỗi verdict có đủ cặp màu đặc và wash', () => {
    for (const v of ['ac', 'wa', 'tle', 'mle', 're', 'ce', 'ie']) {
      expect(CSS).toContain(`--verdict-${v}:`)
      expect(CSS).toContain(`--verdict-${v}-soft:`)
    }
  })
})
