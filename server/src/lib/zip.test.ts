/** vnSlug (chuẩn hoá tên VN) + zipStore (đóng gói .zip store-only). */
import { describe, expect, it } from 'vitest'
import { vnSlug } from './slug'
import { zipStore } from './zip'

describe('vnSlug', () => {
  it('bỏ dấu, đ→d, thường hoá, nối bằng gạch dưới', () => {
    expect(vnSlug('Việt Hoàng')).toBe('viet_hoang')
    expect(vnSlug('Nguyễn Đức')).toBe('nguyen_duc')
    expect(vnSlug('  Lê   Thị Ánh ')).toBe('le_thi_anh')
    expect(vnSlug('ĐÀO')).toBe('dao')
  })
  it('rỗng / toàn ký tự lạ → "user"', () => {
    expect(vnSlug('')).toBe('user')
    expect(vnSlug('@@@ ---')).toBe('user')
  })
})

describe('zipStore', () => {
  it('zip store hợp lệ: chữ ký, tên + dữ liệu nguyên văn, EOCD đếm đúng', () => {
    const enc = new TextEncoder()
    const zip = zipStore([
      { name: 'a.c', data: enc.encode('AAA') },
      { name: 'b.py', data: enc.encode('BBB') },
    ])
    expect(zip.readUInt32LE(0)).toBe(0x04034b50) // local file header
    expect(zip.includes(Buffer.from('a.c'))).toBe(true)
    expect(zip.includes(Buffer.from('AAA'))).toBe(true)
    expect(zip.includes(Buffer.from('b.py'))).toBe(true)
    expect(zip.includes(Buffer.from('BBB'))).toBe(true)
    const eocd = zip.subarray(zip.length - 22)
    expect(eocd.readUInt32LE(0)).toBe(0x06054b50) // end of central directory
    expect(eocd.readUInt16LE(10)).toBe(2) // tổng số entry
  })
})
