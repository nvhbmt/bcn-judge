/**
 * Chuẩn hoá tên tiếng Việt thành slug ASCII an toàn cho tên file.
 *
 *   "Việt Hoàng" → "viet_hoang"    "Nguyễn Đức" → "nguyen_duc"
 *
 * NFD tách dấu rồi bỏ dấu tổ hợp (U+0300–U+036F); đ/Đ không phải dấu tổ hợp nên thay
 * tay. Kết quả chỉ còn a-z0-9 và "_", nhét thẳng vào ZIP không lo ký tự lạ / mã hoá.
 */
export function vnSlug(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[đĐ]/g, (ch) => (ch === 'đ' ? 'd' : 'D'))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'user'
  )
}
