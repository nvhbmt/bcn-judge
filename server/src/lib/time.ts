/**
 * Đổi một mốc timestamptz đọc từ DB thành chuỗi ISO.
 *
 * Vì sao cần helper riêng: node-postgres trả timestamptz về dưới dạng **chuỗi**,
 * không phải `Date`. Gọi thẳng `.toISOString()` trên kết quả truy vấn sẽ ném
 * `TypeError: ... is not a function` — và chỉ ném khi cột đó khác NULL, nên lỗi
 * ngủ yên cho tới lúc có dữ liệu thật. Đây đã là lần thứ tư dự án vấp lớp lỗi
 * này (xem README, mục các lỗi API), nên mọi chỗ đổi mốc thời gian đi qua đây.
 */
export function iso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}
