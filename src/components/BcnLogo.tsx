/**
 * Logo Ban Công Nghệ, dựng bằng SVG thay cho file PNG.
 *
 * VÌ SAO ĐỔI: `logo-bcn.png` (bản trong repo và cả bản trong project thiết kế) bị CỤT
 * FILE — đúng 196608 byte, không có chunk IEND, IDAT cuối đứt giữa chừng. Trình duyệt
 * vẽ được bao nhiêu dòng quét thì vẽ, nên từ ~56% chiều cao trở xuống là trống: mất
 * nửa dưới dòng slogan và mất HẲN cụm gạch chân + cột cờ.
 *
 * Bản SVG cũng bỏ luôn ba thứ mà file ảnh kéo theo: không cần `mix-blend-mode` (chữ là
 * `currentColor`, đổi theme là tự đúng màu), không có khoảng đệm thừa phải cắt bằng
 * tay, và sắc nét ở mọi cỡ với vài trăm byte thay vì 192 KiB.
 *
 * HÌNH HỌC đo trên `design-system/logo-reference.png` — ảnh ĐỦ do người dùng cung cấp,
 * và là bản đầy đủ duy nhất còn lại. Quy về hệ toạ độ có mép trái wordmark = 0, đỉnh
 * thân chữ wordmark = 0:
 *
 *   wordmark   rộng 1578 · cao chữ hoa 142
 *   dấu mũ     y −37 (vươn lên TRÊN thân chữ) · dấu nặng y 146..169
 *   slogan     x 8 · y 199..280 (cao 81) · rộng 953
 *   gạch chân  x 960→1560 · y 322 · dày 5
 *   cột cờ     x 1548 · y 243→322 · dày 5
 *   lá cờ      x 1548→1606 · y 243..279
 *
 * Cụm cuối là CỘT CỜ chứ không phải một khối trang trí: đường kẻ chạy ngang từ chỗ
 * slogan kết thúc, bẻ vuông góc lên thành cột, đỉnh cột có lá cờ đặc nhô sang phải.
 * Đây là chi tiết mà cả hệ thiết kế lấy làm motif nhận diện — `SectionRule` chính là
 * bản trừu tượng hoá của đúng cụm này (nhãn → đường kẻ → khối đặc ở cuối).
 *
 * Bề rộng tuyệt đối không quan trọng (SVG co giãn theo khung chứa); TỈ LỆ mới quan
 * trọng. Montserrat rộng hơn font gốc, nên wordmark giữ tracking tự nhiên rồi mọi toạ
 * độ NGANG suy ra từ bề rộng thật của nó qua `k()`. Toạ độ DỌC giữ nguyên vì cỡ chữ đã
 * đặt theo đúng chiều cao chữ hoa.
 *
 * Ba bẫy đã dính, ghi lại vì cả ba đều im lặng:
 *   - `textLength` phân bố lại khoảng cách giữa các glyph, mà dấu tổ hợp tiếng Việt có
 *     advance width bằng 0 nên bị đẩy văng khỏi chữ cái → "CÔNG" thành "CONG". Chỉ
 *     dùng được cho slogan (không dấu).
 *   - `letterSpacing` âm để ép wordmark về đúng 1578 làm các chữ CHỒNG LÊN NHAU.
 *   - `viewBox` bắt đầu từ y = 0 cắt mất dấu mũ, nên phải bắt đầu từ y ÂM.
 *
 * Đây là bản DỰNG LẠI bằng Montserrat, không phải chữ gốc của CLB. Có file vector gốc
 * thì thay thẳng vào đây.
 */
const FONT = "'Montserrat', var(--font-ui)"

/** Cao chữ hoa của Montserrat ≈ 0,70em → font-size = chiều cao mong muốn ÷ 0,70. */
const WORD_SIZE = Math.round(142 / 0.7)
const TAG_SIZE = Math.round(81 / 0.7)

/**
 * Bề rộng TỰ NHIÊN của wordmark ở Montserrat Bold cỡ trên, đo trên trình duyệt
 * (`getBBox().width`). `k()` quy toạ độ ngang đo trên ảnh gốc (hệ 1578) sang hệ này.
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
      viewBox={`0 -60 ${k(1606)} 400`}
      role="img"
      aria-label={title}
      className={className}
      preserveAspectRatio="xMinYMid meet"
    >
      <text x="0" y="142" fill="currentColor" style={{ fontFamily: FONT, fontSize: WORD_SIZE, fontWeight: 700 }}>
        BAN CÔNG NGHỆ
      </text>

      <text
        x={k(8)}
        y="280"
        textLength={k(953)}
        lengthAdjust="spacing"
        fill="currentColor"
        style={{ fontFamily: FONT, fontSize: TAG_SIZE, fontWeight: 300 }}
      >
        School Life Stories
      </text>

      {/* Gạch chân → cột → lá cờ. Ba hình rời chứ không một path liền, nhưng cột CỐ Ý
          chồng xuống hết bề dày gạch chân để mối nối không hở khi co giãn về cỡ nhỏ. */}
      <g fill="currentColor">
        <rect x={k(960)} y="322" width={k(600)} height="5" />
        <rect x={k(1548)} y="243" width={k(6)} height="84" />
        <rect x={k(1548)} y="243" width={k(58)} height="36" />
      </g>
    </svg>
  )
}
