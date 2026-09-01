/**
 * Logo Ban Công Nghệ, dựng bằng SVG thay cho file PNG.
 *
 * VÌ SAO ĐỔI: `src/assets/logo-bcn.png` trong repo bị CỤT FILE — đúng 196608 byte
 * (192 KiB), không có chunk IEND, IDAT cuối đứt giữa chừng. Trình duyệt vẽ được bao
 * nhiêu dòng quét thì vẽ, nên từ ~56% chiều cao trở xuống là trống và dòng slogan
 * "School Life Stories" mất một nửa. Kéo lại từ project thiết kế cũng chỉ nhận được
 * đúng 196608 byte, nên không sửa được bằng cách thay file.
 *
 * Bản SVG này khắc phục luôn ba thứ khác mà file ảnh gây ra: không cần
 * `mix-blend-mode` (chữ là `currentColor`, đổi theme là tự đúng màu), không có khoảng
 * đệm thừa phải cắt bằng tay, và sắc nét ở mọi cỡ với vài trăm byte thay vì 192 KiB.
 *
 * HÌNH HỌC đo trực tiếp trên file gốc (1926×1934) rồi quy về hệ toạ độ có đỉnh thân
 * chữ wordmark = 0 và mép trái wordmark = 0:
 *
 *   wordmark  cao chữ hoa 141 · rộng 1578
 *   dấu mũ    vươn lên 37 phía TRÊN thân chữ
 *   dấu nặng  xuống 27 phía dưới thân chữ
 *   slogan    đỉnh ở y = 199 · lệch trái 11 · rộng 948
 *
 * Bề rộng slogan bằng **0,601** bề rộng wordmark. Tỉ lệ đó là thứ mắt bắt được ngay
 * nếu sai, nên slogan dùng `textLength` ép đúng bề rộng. Wordmark thì TUYỆT ĐỐI không
 * được dùng `textLength`: nó phân bố lại khoảng cách giữa các glyph, mà dấu tổ hợp
 * tiếng Việt có advance width bằng 0 nên bị đẩy văng khỏi chữ cái — "CÔNG" hiện ra
 * thành "CONG" (đã nhìn thấy trên trình duyệt). Slogan không có dấu nên an toàn.
 * Bề rộng wordmark chỉnh bằng `letterSpacing`, đo trên trình duyệt cho khớp 1578.
 *
 * `viewBox` bắt đầu từ y ÂM, và đó là chi tiết bắt buộc: dấu mũ vươn lên trên y = 0.
 * Khung bắt đầu từ 0 thì SVG cắt mất đúng phần đó — logo hiện ra "BAN CONG NGHẸ" mà
 * dấu nặng dưới chữ E vẫn còn, đúng hình dạng khiến người ta đi ngờ oan cho font.
 *
 * Chữ dùng Montserrat (hình học, gần logo gốc nhất trong số font có trên Google Fonts)
 * và PHẢI là subset `vietnamese` chuẩn — tham số cắt bộ chữ `text=` của Google trả về
 * thiếu glyph dấu mũ, xem chú thích ở index.html.
 *
 * Đây là bản DỰNG LẠI, không phải file gốc của CLB. Có bản vector gốc thì thay thẳng
 * vào đây.
 */
const FONT = "'Montserrat', var(--font-ui)"

/** Cao chữ hoa của Montserrat ≈ 0,70em → font-size = chiều cao mong muốn ÷ 0,70. */
const WORD_SIZE = Math.round(141 / 0.7)
const TAG_SIZE = Math.round(70 / 0.7)

/**
 * Bề rộng TỰ NHIÊN của wordmark ở Montserrat Bold cỡ trên, đo trên trình duyệt
 * (`getBBox().width`). Montserrat rộng hơn font gốc của CLB, nên ép nó về đúng 1578
 * của bản gốc bằng `letterSpacing` âm làm các chữ CHỒNG LÊN NHAU — đã thử -19,7: bề
 * rộng khớp nhưng "BAN" dính liền và "CÔNG" đè "NGHỆ".
 *
 * Bề rộng tuyệt đối vốn không quan trọng: SVG co giãn theo khung chứa nó. Thứ mắt bắt
 * được là TỈ LỆ. Nên giữ wordmark ở tracking tự nhiên rồi suy mọi kích thước khác từ
 * nó theo đúng tỉ lệ đo trên file gốc.
 */
const W = 1825
const k = (goc: number) => Math.round((goc * W) / 1578)

export function BcnLogo({
  className = '',
  title = 'Ban Công Nghệ — School Life Stories',
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox={`0 -60 ${W} 340`}
      role="img"
      aria-label={title}
      className={className}
      preserveAspectRatio="xMinYMid meet"
    >
      <text
        x="0"
        y="141"
        fill="currentColor"
        style={{ fontFamily: FONT, fontSize: WORD_SIZE, fontWeight: 700 }}
      >
        BAN CÔNG NGHỆ
      </text>

      <text
        x={k(11)}
        y="269"
        textLength={k(948)}
        lengthAdjust="spacing"
        fill="currentColor"
        style={{ fontFamily: FONT, fontSize: TAG_SIZE, fontWeight: 300 }}
      >
        School Life Stories
      </text>

      {/* Dấu góc vuông + gạch chân ở cuối dòng slogan — chi tiết mà cả hệ thiết kế lấy
          làm motif nhận diện (xem SectionRule). Đây là chỗ nó bắt nguồn. Nó nằm trong
          vùng dữ liệu đã mất của file PNG nên kích thước lấy theo tỉ lệ còn nhìn thấy
          được ở bản dựng trước lúc phát hiện file hỏng. */}
      <rect x={k(1478)} y="243" width={k(100)} height="22" fill="var(--moss)" />
    </svg>
  )
}
