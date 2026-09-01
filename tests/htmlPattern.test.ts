/**
 * Mọi `pattern="..."` trong `src/` phải biên dịch được như TRÌNH DUYỆT biên dịch nó.
 *
 * HTML nói rõ `pattern` được compile với cờ `v` (unicodeSets). Ở đó luật lớp ký tự
 * chặt hơn hẳn regex thường: `[\w-]+` hợp lệ với `new RegExp(p)` nhưng là LỖI CÚ PHÁP
 * với cờ `v`. Và khi pattern hỏng, trình duyệt không báo lỗi cho người dùng — nó bỏ
 * qua luật rồi log một dòng ra console, nên ô nhập trông như có kiểm mà thật ra không
 * kiểm gì. Lỗi đúng kiểu đó đã lọt vào ô "Mã khoá" và chỉ lộ ra khi một test E2E soi
 * console.
 *
 * Test này quét cả thư mục chứ không chốt một ô cụ thể: nó canh MỘT LỚP lỗi.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.tsx?$/.test(name) ? [full] : []
  })
}

function patternsIn(file: string): { file: string; pattern: string }[] {
  const src = readFileSync(file, 'utf8')
  return [...src.matchAll(/pattern="([^"]+)"/g)].map((m) => ({ file, pattern: m[1]! }))
}

describe('thuộc tính pattern của HTML', () => {
  const found = walk('src').flatMap(patternsIn)

  it('có ít nhất một ô đang dùng pattern (nếu không, test này vô nghĩa)', () => {
    expect(found.length).toBeGreaterThan(0)
  })

  it.each(found)('$pattern ($file) biên dịch được với cờ v', ({ pattern }) => {
    // Đúng cách trình duyệt bọc: neo hai đầu rồi compile với cờ `v`.
    expect(() => new RegExp(`^(?:${pattern})$`, 'v')).not.toThrow()
  })
})
