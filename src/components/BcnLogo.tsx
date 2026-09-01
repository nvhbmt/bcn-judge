/**
 * Logo Ban Công Nghệ, dựng bằng SVG thay cho file PNG.
 *
 * VÌ SAO ĐỔI: `src/assets/logo-bcn.png` trong repo bị CỤT FILE — đúng 196608 byte
 * (192 KiB), không có chunk IEND, IDAT cuối đứt giữa chừng. Trình duyệt vẽ được bao
 * nhiêu dòng quét thì vẽ, nên từ ~56% chiều cao trở xuống là trống và dòng slogan
 * "School Life Stories" mất một nửa. Kéo lại từ project thiết kế cũng chỉ nhận được
 * đúng 196608 byte, nên không sửa được bằng cách thay file.
 *
 * Bản SVG này khắc phục luôn ba thứ khác mà file ảnh gây ra:
 *   - Không cần `mix-blend-mode` nữa. File PNG là chữ sáng trên nền đen đặc nên phải
 *     hoà trộn mới dùng được trên nền kem; ở đây chữ là `currentColor`, đổi theme là
 *     tự đúng màu.
 *   - Không có khoảng đệm thừa. PNG là hình vuông mà chữ chỉ chiếm dải 43–55% chiều
 *     cao, nên chỗ nào dùng cũng phải cắt bằng tay.
 *   - Sắc nét ở mọi kích thước, và nặng vài trăm byte thay vì 192 KiB.
 *
 * KHÔNG dùng `textLength`/`lengthAdjust` để ép bề rộng, dù ban đầu rất muốn: hai
 * thuộc tính đó phân bố lại khoảng cách giữa các glyph, mà DẤU TỔ HỢP tiếng Việt có
 * advance width bằng 0 nên bị đẩy văng khỏi chữ cái nó thuộc về — "CÔNG" hiện ra
 * thành "CONG", "NGHỆ" thành "NGHẸ" (đã nhìn thấy trên trình duyệt). Với một logo
 * tiếng Việt thì đó là lỗi không thể chấp nhận. Bề rộng vì vậy để font tự quyết, và
 * `preserveAspectRatio` lo phần co giãn.
 *
 * Tỉ lệ lấy từ chính file gốc: chiều cao chữ hoa 120, slogan 70, hai dòng cách nhau
 * 90 (đo trên ảnh 1926×1934).
 *
 * viewBox bắt đầu từ y = -62 chứ không phải 0, và đó là chi tiết BẮT BUỘC: dấu mũ của
 * Ô và Ệ vươn lên trên đường cao chữ hoa, tức lên trên y = 0. Khung bắt đầu từ 0 thì
 * SVG cắt mất đúng phần đó — logo hiện ra "BAN CONG NGHẸ", trong khi dấu nặng dưới
 * chữ E vẫn còn vì nó nằm dưới đường chân chữ. Mất hai tiếng đi ngờ oan cho font và
 * cho bộ chữ cắt của Google trước khi nhận ra thủ phạm là cái khung.
 *
 * Chữ dùng Montserrat (hình học, gần logo gốc nhất trong số font có sẵn trên Google
 * Fonts) và PHẢI là subset `vietnamese` chuẩn — tham số cắt bộ chữ `text=` của Google
 * trả về thiếu glyph dấu mũ, xem chú thích ở index.html.
 *
 * Đây là bản DỰNG LẠI, không phải file gốc của CLB. Có bản vector gốc thì thay thẳng
 * vào đây.
 */
export function BcnLogo({
  className = '',
  title = 'Ban Công Nghệ — School Life Stories',
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 -62 1620 372"
      role="img"
      aria-label={title}
      className={className}
      preserveAspectRatio="xMinYMid meet"
    >
      <text
        x="0"
        y="120"
        fill="currentColor"
        style={{
          fontFamily: "'Montserrat', var(--font-ui)",
          fontSize: 171,
          fontWeight: 700,
        }}
      >
        BAN CÔNG NGHỆ
      </text>

      <text
        x="0"
        y="280"
        fill="currentColor"
        letterSpacing="14"
        style={{
          fontFamily: "'Montserrat', var(--font-ui)",
          fontSize: 100,
          fontWeight: 300,
        }}
      >
        School Life Stories
      </text>

      {/* Dấu góc vuông + gạch chân ở cuối dòng slogan — chi tiết mà cả hệ thiết kế
          lấy làm motif nhận diện (xem SectionRule). Đây là chỗ nó bắt nguồn. */}
      <rect x="1520" y="252" width="100" height="24" fill="var(--moss)" />
    </svg>
  )
}
