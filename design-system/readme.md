# Hệ thiết kế BCN Judge v2

Nguồn: project thiết kế `b37de235` ("Cải tiến giao diện hiện đại"), file
`BCN Judge v2 - So sanh toi sang.dc.html` — 8 màn × 2 theme.

Bốn file trong `src/` trỏ về đây (`src/index.css`, `src/components/ui/index.tsx`,
`src/components/layout/TopBar.tsx`, `src/lib/theme.ts`), nên file này là **hợp đồng**,
không phải ghi chú: sửa một giá trị ở đây mà không sửa `tokens/` là làm tài liệu nói dối.

## VISUAL FOUNDATIONS

Ba luật, ép ở `src/components/ui/index.tsx` vì đó là chỗ mọi màn hình đi qua:

1. **Bo góc 0.** Ngoại lệ duy nhất là **chấm trạng thái** (`size-2 rounded-full`) và
   vòng xoay của `Spinner` — hai thứ tròn theo bản chất, không phải lựa chọn bán kính.
   Chip, huy hiệu, ô số thứ tự đều vuông.
2. **Không bóng đổ.** Cần phân tầng thì dùng đường kẻ (`--line`, `--line-strong`) hoặc
   đổi nền một bậc (`--surface-0` → `--surface-3`). `shadow-[inset_0_-2px_0_…]` KHÔNG
   phải ngoại lệ: đó là gạch chân tab, không phải bóng.
3. **Mono cho mọi con số và verdict; nhãn nút ALL-CAPS.** Hai đồng hồ đếm ngược cùng
   giá trị mà khác font là lỗi. Tiêu đề dùng Lora (`--font-display`).

## Thang màu

Trung tính **ấm** (không phải `slate`) + hai màu điểm: xanh rêu `--moss` (xong / đang
mở) và nâu đất `--earth` / `--clay` (cần chú ý). Giá trị thật ở `tokens/colors.css`.

Ngưỡng cứng, đo trên nền xấu nhất mỗi theme (tối: `--surface-sel`, sáng: `--surface-0`):

| Bậc | Vai trò | Ngưỡng |
|---|---|---|
| `--ink-1` … `--ink-6` | chữ mang thông tin | **≥ 4.5:1** |
| `--ink-7` | CHỈ trang trí — đường phân cách, chấm | không đặt chữ |

Hệ quả thực tế đã gặp: `disabled:opacity-40/50/60` kéo tương phản xuống 2,33–3,99:1 nên
**không dùng opacity để làm mờ điều khiển đã tắt** — đổi màu chữ sang `--ink-5` và làm
nhạt đường viền, giữ `opacity-100`. "Đã tắt" không có nghĩa là "không đọc được".

## Vì sao bản sáng từng "hoà tan"

Cảm giác bản sáng nhạt hơn bản tối **không phải** do thiếu tương phản. Đo ra thì bản
sáng còn hơn ở mọi chỉ số: tách mặt phẳng nền 1.07–1.19 (tối chỉ 1.02–1.05), băng cảnh
báo 1.16–1.18 (tối 1.06), và bão hoà **tương đối** so với gamut đạt 65–88% (tối chỉ
52–63%).

Nguyên nhân là **hướng** tương phản. Nền tối, màu điểm sáng hơn nền (L 0.64–0.74 trên
nền L≈0.15) nên mắt đọc ra là ánh sáng phát ra, nó tiến về trước. Nền sáng, màu điểm
tối hơn nền (L 0.42–0.51 trên nền L≈0.97) nên mắt đọc ra là mực trên giấy — trông y
như chữ thường. Cùng tỉ lệ tương phản, ngược vai trò thị giác.

Và có trần vật lý: ở L 0.42–0.51 thì sRGB chỉ chứa nổi C 0.10–0.18, mà palette đã dùng
tới 65–88% mức đó. **Không còn chỗ tăng độ rực nếu vẫn giữ độ tối ấy.** Nên cách chữa
là tăng **diện tích** màu, không phải tăng độ rực:

- huy hiệu verdict có hai cấp — `solid` (nền đặc, chữ `--on-accent`) cho chỗ đứng một
  mình, `soft` (nền wash, chữ giữ màu verdict) cho bảng dày. Năm mươi khối đặc xếp dọc
  thành một mảng loang, lúc đó chẳng dòng nào nổi nữa;
- `--primary-soft` mang sắc thật thay vì trỏ vào `--surface-sel`. Đây là lỗi nặng nhất:
  chín chỗ vẽ trạng thái "đang chọn" ở bản sáng trước đây không có màu nào cả;
- băng cảnh báo bỏ alpha, dùng màu đặc đậm hơn — chênh giữa các mặt phẳng nền bản sáng
  chỉ 1.07 nên alpha chẳng lợi gì, mà giá trị đo được thì thôi đúng ở mọi chỗ.

Chroma của các wash ghìm ở **35% gamut**. Thử 75% cho ra `#a8db5e` xanh lá chanh, lạc
hẳn thang trung tính ấm — đúng thứ mục 3 ở trên cấm.

`tint-earth` nhạt hơn hai wash kia (1.45 thay vì 1.50) và đó là ràng buộc chứ không
phải tuỳ ý: earth là màu sáng nhất trong ba, nên nền earth đậm thêm một nấc là chữ
earth trên nó tụt dưới 4.5:1. `tests/lightAccents.test.ts` canh mọi ngưỡng này, đọc
thẳng từ file token.

`--select-bg` (vệt bôi đen trong editor) tách riêng khỏi `--surface-sel`: dòng đang gõ
đã dùng `--surface-sel`, nếu vùng chọn dùng chung thì bôi đen trên chính dòng đó không
thấy gì. Đặt ~2.1:1 so với nền editor — đủ rõ mà chữ bên trên vẫn đọc được. Ngưỡng
3:1 của WCAG 1.4.11 là cho **ranh giới thành phần**, không áp cho nền vùng chọn có chữ
nằm trên.

## Kích thước cố định

Lấy đúng từ thiết kế, **không làm tròn về bội số 8** — thang khoảng cách cố ý có 6, 10,
14, 22, 26:

| | |
|---|---|
| thanh trên | 48px |
| rail biểu tượng | 56px |
| đầu mục | 38px |
| console | 302px |
| khung tối thiểu | 320px |
| khối cuối `SectionRule` | 18×6px |

## Motif nhận diện

`SectionRule`: nhãn mono → đường kẻ chạy hết chiều ngang → khối 18×6px ở cuối. Lấy từ
dấu góc vuông + gạch chân trong logo Ban Công Nghệ. Nó **thay cho `<h2>`**, nên phải
render thẻ tiêu đề thật — đường kẻ và khối cuối là trang trí nên `aria-hidden`.

## Theme

Đổi bằng `[data-theme]` trên `<html>` (`src/lib/theme.ts`), **không** bằng
`prefers-color-scheme`. Vì vậy trong `src/` không được dùng cặp `dark:` của Tailwind:
nó biên dịch thành `@media (prefers-color-scheme)` nên sẽ nghe hệ điều hành chứ không
nghe nút đổi theme — app tối + OS sáng cho ra mảng gần trắng giữa nền tối.

Lệnh quét, phải ra **0** — và nhớ quét cả `*.ts` chứ không riêng `*.tsx` (đã từng bỏ
sót `src/pages/mentor/contestPhase.ts` đúng vì vậy):

```bash
grep -rnE '(^|[^a-z-])(slate-|dark:)' src --include='*.ts' --include='*.tsx'
```

Ranh giới `(^|[^a-z-])` là bắt buộc, không phải cầu kỳ: `grep "slate-"` trần khớp cả
`-translate-y-1/2` (tran**slate-**y) và cho bốn kết quả rác mỗi lần quét. Cặp `dark:`
cũng khớp nhầm tham số TypeScript `(dark: boolean)` — đọc kết quả rồi hãy tin.

### Một điểm lệch có chủ đích

Thiết kế chốt **mặc định tối** ("contest hay chấm bài buổi tối, đổi theme giữa lúc gõ
code thì loá mắt"). Dự án này chọn **mặc định sáng**, nút đổi nằm trên thanh trên. Ghi
ở đây và ở `src/lib/theme.ts` để người sau đọc thiết kế không tưởng là code sai.

## Nạp vào Tailwind

`tokens/*.css` là nguồn giá trị; `src/index.css` ánh xạ chúng vào khối `@theme` của
Tailwind v4. Class nào không có mặt trong `@theme` sẽ **im lặng không sinh CSS** — đã
mất `.font-display` trên 28 chỗ đúng vì `--font-display` khai bằng `var(--font-display)`
(tự trỏ vào chính nó → rỗng). Khai giá trị literal trong `@theme`, và sau khi thêm token
mới thì kiểm bằng:

```bash
npm run build && grep -c "\.font-display" dist/assets/index-*.css   # phải > 0
```

---

## Phụ lục: những điểm CHỈ đúng với repo bcn-judge

Phần trên là tài liệu gốc của hệ thiết kế. Phần này ghi chỗ repo cố ý làm khác, và
những cái bẫy đã thật sự cắn khi triển khai — để người sau đọc bản gốc không tưởng là
code sai.

### Theme mặc định là SÁNG, không phải tối

Tài liệu trên chốt **mặc định tối**. Repo này chọn **mặc định sáng**, nút đổi nằm ở
thanh trên. Đây là quyết định của người dùng, không phải sơ suất. Xem `src/lib/theme.ts`.

### `design-system/` phải nạp vào `@layer base`

`src/index.css` viết `@import '../design-system/styles.css' layer(base)` — chữ
`layer(base)` là bắt buộc. CSS không nằm trong layer nào luôn thắng mọi `@layer`, mà
class tiện ích của Tailwind v4 nằm trong `@layer utilities`. Để nguyên thì
`a { color: var(--moss) }` của `tokens/base.css` nuốt luôn `text-on-accent` đặt trên
một `<a>`, và mọi nút-dạng-link thành chữ xanh rêu trên nền xanh rêu.

### Lệnh quét `slate-` / `dark:` phải neo ranh giới

```bash
grep -rnE '(^|[^a-z-])(slate-|dark:)' src --include='*.ts' --include='*.tsx'
```

`grep "slate-"` trần khớp cả `-translate-y-1/2` (tran**slate-**y) và cho bốn kết quả
rác mỗi lần quét; `dark:` trần khớp tham số TypeScript `(dark: boolean)`. Nhớ quét cả
`*.ts` chứ không riêng `*.tsx` — đã từng bỏ sót `src/pages/mentor/contestPhase.ts` đúng
vì vậy.

### Logo là SVG, không phải `assets/logo-bcn.png`

File PNG trong project thiết kế **cụt** (196608 byte, không có chunk IEND) nên nửa dưới
không vẽ được, và kéo lại qua công cụ cũng chỉ nhận đúng chừng đó byte. Logo nay dựng
bằng chữ ở `src/components/BcnLogo.tsx`, tô `currentColor` nên không cần
`mix-blend-mode` nữa. Có bản vector gốc thì thay thẳng vào đó.

Hai bẫy khi dựng, cả hai đều im lặng:
- `textLength`/`lengthAdjust` phân bố lại khoảng cách giữa các glyph, mà dấu tổ hợp
  tiếng Việt có advance width bằng 0 nên bị đẩy văng khỏi chữ cái.
- `viewBox` bắt đầu từ `y=0` cắt mất dấu mũ (dấu vươn lên trên đường cao chữ hoa), cho
  ra "BAN CONG NGHẸ" trong khi dấu nặng dưới chữ E vẫn còn.

### Ba thứ trong bản vẽ CỐ Ý không dựng

Hợp đồng nội dung ở trên nói: chức năng chưa có thì bỏ khỏi màn hình, đừng viết "đang
được phát triển". Áp đúng vậy cho ba chỗ:
- ô `⌘K tìm bài` ở thanh trên — app chưa có tìm kiếm toàn cục;
- ô ghi chú của leader ở màn 06 — backend chưa có chỗ lưu;
- các con số vận hành vẽ sẵn ở màn đăng nhập ("4 worker · 16 slot · hàng đợi rỗng") —
  chỉ đọc được qua `/api/admin/judge`, tức phải đăng nhập bằng quyền admin mới có.
  `SystemLog` thay bằng sự thật tĩnh về sandbox cộng một dòng động lấy từ `/healthz`.

### Ngữ pháp bố cục dùng chung

Bảy mẫu lặp trên cả 8 màn nằm ở `src/components/ui/patterns.tsx`: `RowGroup`/`Row`
(nhóm dòng ngăn nhau bằng khe 1px — cách trình bày danh sách DUY NHẤT của hệ),
`Segments`, `StatStrip`, `Avatar`, `Divider`, `SideColumn`, `SideLabel`.
Dựng danh sách mới thì dùng lại chúng, đừng viết class rời.

`KeyHint` (chip phím tắt `⌘K tìm bài`) từng nằm trong danh sách này và đã bị xoá: chỗ
duy nhất dùng nó là ô tìm kiếm toàn cục, mà chính trang này đã gạch ô đó khỏi thiết kế
ở mục trên. Một mẫu không màn nào dùng thì không phải mẫu — và giữ nó lại là mời người
sau vẽ ra phím tắt chưa tồn tại. Cần lại thì dựng lại cùng lúc với tính năng.
