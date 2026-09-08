# BCN Judge — Đặc tả yêu cầu

| | |
|---|---|
| Trạng thái | Bản nháp **v0.8** — 08/09/2026 (v0.8: điểm tích luỹ theo **độ khó** và BXH xếp **tổng điểm trước** — FR-F2/FR-G6; v0.2: trả lời Q1–Q4, Q10 — C chuẩn, contest theo tuần, 120 member; v0.3: thêm sidebar trái; v0.4: sidebar chốt dạng **thanh icon + tooltip**, bấm icon đổi nội dung khung đầu — Mô tả · Giáo trình · Bảng xếp hạng · Trợ giúp; v0.5: sửa 32 phát hiện của vòng review song song — mô hình hai chế độ khung đầu, thang điểm chuẩn hoá 0–100, giới hạn mặc định và điều kiện đo cụ thể; v0.6 — 01/09/2026: 3 điều chỉnh theo nợ kỹ thuật của `design.md` §14 — phạm vi ≤ 5 giây chỉ cho BXH contest, diễn giải luật ưu tiên FR-F6, mặc định ghi đĩa theo tmpfs; v0.7: thêm **Team & Leader** — member thuộc một team, leader theo dõi tiến độ và bài nộp của team (FR-J)) |
| Nguồn | Kết quả `/sc:brainstorm`. Tài liệu này chỉ mô tả **yêu cầu**; kiến trúc, schema, API nằm ở `docs/design.md` (bước `/sc:design`). |
| Người đọc | BCN (admin), mentor, người sẽ triển khai |

---

## 1. Tóm tắt

BCN Judge là hệ thống chấm bài tập lập trình nội bộ của ban. Quản lý viên (admin, mentor) tổ chức bài tập theo **khoá học**; thành viên làm bài trên một màn hình gồm **thanh icon điều hướng bên trái**, **khung nội dung ở giữa** và **khung soạn code bên phải** với vạch chia kéo được, chạy thử rồi nộp bài để hệ thống **chấm tự động bằng testcase**. Mỗi tuần ban mở một **contest** — một chuỗi bài tập trong khung thời gian nhất định, có bảng xếp hạng. Thành viên được tổ chức thành các **team**, mỗi team có một **leader** theo dõi tiến độ và bài nộp của team mình.

Ba việc hệ thống phải làm tốt:

1. **Mentor đăng bài tập kèm testcase trong ≤ 10 phút** (bài 10 testcase, kịch bản US-2), tự kiểm tra được testcase bằng lời giải mẫu, ghép bài thành contest tuần mà không cần người kỹ thuật can thiệp.
2. **Member học theo khoá và thi contest hằng tuần ngay trên trình duyệt**, biết kết quả từng testcase trong vài giây (định lượng ở NFR-4), không mất code khi reload.
3. **Admin quản lý người dùng, khoá học và cấu hình chấm** hoàn toàn qua giao diện.

## 2. Bối cảnh: đã xác nhận & còn giả định

**Đã xác nhận với BCN (31/08/2026)**

- **Quy mô**: 120 member hiện tại.
- **Tài khoản do admin cấp**; không mở đăng ký tự do.
- **Server có Docker** — dùng được để cách ly chấm bài.
- **Contest theo tuần** là một phần của v1: mỗi contest là một chuỗi bài tập.
- **Ngôn ngữ bắt buộc**: C chuẩn, C++, Python.

**Vẫn là giả định** (mục 10 liệt kê câu hỏi)

- Thiết kế dự phòng tới 300 member; ước chừng vài mentor, 1–3 admin — chưa hỏi BCN (Q16).
- Contest kéo dài cả tuần (làm lúc nào cũng được) chứ không phải giờ thi tập trung; cao điểm ước ≤ 40 người nộp cùng lúc trong giờ đầu contest.
- Ngôn ngữ giao diện tiếng Việt; đề bài có thể chứa tiếng Anh.
- Triển khai trên một VPS do BCN quản lý, tương tự cách iexam.vn đang chạy.
- Member chủ yếu dùng laptop; điện thoại chỉ cần đọc đề, xem kết quả và bảng xếp hạng.

## 3. Vai trò & quyền

Mỗi tài khoản có đúng một vai trò hệ thống. Mentor chỉ có quyền trong các khoá được admin gán. Admin ngầm có mọi quyền của mentor ở mọi khoá. **Leader** không phải vai trò hệ thống thứ tư: đó là một member được admin gán đứng đầu team của mình (nhóm FR-J), chỉ thêm quyền **xem** trong phạm vi team.

| Vai trò | Là ai | Việc chính |
|---|---|---|
| **Admin** | BCN / người vận hành | Cấp tài khoản, gán vai trò, tạo khoá, gán mentor, tạo contest toàn ban, cấu hình ngôn ngữ chấm và giới hạn, theo dõi hàng đợi chấm |
| **Mentor** | Người hướng dẫn một hoặc nhiều khoá | Soạn chương, bài đọc, bài tập, testcase; tạo contest trong khoá mình; ghi danh member; xem bài nộp và tiến độ |
| **Member** | Thành viên ban | Vào khoá đã ghi danh, đọc nội dung, code, chạy thử, nộp bài, thi contest, xem lịch sử và bảng xếp hạng. Nếu là **leader**: thêm quyền xem tiến độ và bài nộp của thành viên team mình |

### Ma trận quyền

| Hành động | Admin | Mentor (khoá được gán) | Member (khoá đã ghi danh) |
|---|:-:|:-:|:-:|
| Tạo / khoá / đặt lại mật khẩu tài khoản, đổi vai trò | ✓ | – | – |
| Tạo / sửa / lưu trữ khoá học | ✓ | sửa mô tả | – |
| Gán mentor vào khoá | ✓ | – | – |
| Ghi danh / gỡ member khỏi khoá | ✓ | ✓ | – |
| Tạo / sửa / xuất bản chương, bài đọc, bài tập, testcase | ✓ | ✓ | – |
| Xem testcase ẩn và lời giải tham khảo | ✓ | ✓ | – |
| Tạo / sửa / xuất bản contest | ✓ (cả toàn CLB) | trong khoá | – |
| Xem nội dung khoá | ✓ | ✓ | chỉ mục đã xuất bản |
| Chạy thử, nộp bài | ✓ | ✓ | ✓ |
| Xem bảng xếp hạng khoá / contest | ✓ | ✓ | ✓ |
| Xem bài nộp và source của người khác | ✓ | trong khoá | – |
| Xem bảng tiến độ khoá, thống kê contest | ✓ | ✓ | chỉ của mình |
| Tạo / sửa team, xếp member vào team, gán leader | ✓ | – | – |
| Xem tiến độ và bài nộp (kèm source) của thành viên team | ✓ | trong khoá | chỉ leader — team mình |
| Cấu hình ngôn ngữ chấm, giới hạn mặc định, hàng đợi | ✓ | – | – |

## 4. Từ điển khái niệm

Đây là ngôn ngữ chung dùng xuyên suốt tài liệu và code; **không phải** schema dữ liệu.

- **Khoá học (Course)** — đơn vị tổ chức lớn nhất: tên, mã, mô tả, trạng thái *Nháp / Đang mở / Lưu trữ*, danh sách mentor phụ trách, danh sách member ghi danh.
- **Chương (Section)** — nhóm có thứ tự trong khoá, chứa các *mục*.
- **Mục (Item)** — một phần tử có thứ tự trong chương; là **Bài đọc** hoặc **Bài tập**. Mục có trạng thái *Nháp / Xuất bản*.
- **Bài đọc (Lesson)** — nội dung lý thuyết (Markdown, code block, ảnh, công thức).
- **Bài tập (Problem)** — đề bài, mô tả input/output, ràng buộc, ví dụ, giới hạn thời gian và bộ nhớ, ngôn ngữ cho phép, code khởi tạo, lời giải tham khảo, danh sách testcase. Một bài có thể xuất hiện trong nhiều khoá và nhiều contest.
- **Testcase** — một cặp *input / expected output*, thuộc loại **mẫu** (member thấy được) hoặc **ẩn**, có trọng số điểm và thứ tự.
- **Contest** — một chuỗi bài tập có thứ tự, có thời điểm bắt đầu và kết thúc (mặc định một tuần), thuộc một khoá học hoặc toàn ban; có bảng xếp hạng.
- **Bảng xếp hạng (Standings)** — thứ hạng member trong một contest (tính từ các bài nộp trong khung thời gian contest) hoặc trong một khoá học (số bài AC, tổng điểm tích luỹ).
- **Lượt chạy thử (Run)** — biên dịch và chạy code với testcase mẫu hoặc input tự nhập. Không tính là nộp bài, không lưu vào lịch sử.
- **Bài nộp (Submission)** — source code của member cho một bài tập, được chấm trên **toàn bộ** testcase; lưu lâu dài kèm kết quả từng testcase (thời hạn tối thiểu theo NFR-7); có thể gắn với một contest.
- **Verdict** — kết quả chấm: `AC` đúng, `WA` sai đáp án, `TLE` quá thời gian, `MLE` quá bộ nhớ, `RE` lỗi runtime, `CE` lỗi biên dịch, `IE` lỗi hệ thống (không phải lỗi của member), cùng hai trạng thái tạm `PENDING` / `RUNNING`.
- **Ghi danh (Enrollment)** — quan hệ member ↔ khoá học.
- **Team (Nhóm)** — nhóm thành viên cấp ban; mỗi member thuộc **tối đa một team**. Mỗi team có đúng một **Leader** — một member trong team, do admin gán, có thêm quyền xem tiến độ và bài nộp của team mình.
- **Tiến độ** — với mỗi cặp (member, bài tập): *Chưa làm / Đã thử / Đã AC*, suy ra từ bài nộp tốt nhất.

## 5. Yêu cầu chức năng

Mức ưu tiên: **M** = bắt buộc trong v1 · **S** = nên có trong v1 nếu kịp · **C** = để sau v1.

### FR-A · Tài khoản & đăng nhập

| ID | Ưu tiên | Yêu cầu |
|---|:-:|---|
| FR-A1 | M | Đăng nhập bằng email (hoặc tên đăng nhập) + mật khẩu. Phiên đăng nhập giữ qua reload trình duyệt; có đăng xuất. |
| FR-A2 | M | Admin tạo tài khoản đơn lẻ **và** nhập hàng loạt từ CSV (họ tên, email, vai trò, khoá ghi danh). Mật khẩu ban đầu do admin đặt hoặc hệ thống sinh; bắt đổi ở lần đăng nhập đầu. Không có đăng ký tự do. |
| FR-A3 | M | Người dùng tự đổi mật khẩu. Admin đặt lại mật khẩu cho bất kỳ ai. |
| FR-A4 | S | Khoá / mở khoá tài khoản. Tài khoản bị khoá không đăng nhập được nhưng mọi bài nộp và tiến độ giữ nguyên. |
| FR-A5 | C | Đăng nhập Google, giới hạn theo domain email. |

### FR-B · Quản lý khoá học

| ID | Ưu tiên | Yêu cầu |
|---|:-:|---|
| FR-B1 | M | Admin tạo khoá: tên, mã ngắn, mô tả Markdown, trạng thái *Nháp / Đang mở / Lưu trữ*. Member chỉ thấy khoá *Đang mở* đã ghi danh. |
| FR-B2 | M | Admin gán một hoặc nhiều mentor cho khoá; gỡ mentor. Mentor được sửa mô tả của khoá mình phụ trách (khớp ma trận mục 3). |
| FR-B3 | M | Admin và mentor ghi danh member: chọn từ danh sách người dùng hoặc dán danh sách email. Gỡ ghi danh không xoá bài nộp. |
| FR-B4 | S | Khoá có cờ *tự ghi danh*: member tự tham gia bằng mã khoá; mặc định là khoá kín. |
| FR-B5 | M | Trang chủ của member liệt kê khoá đã ghi danh kèm tiến độ (số bài AC / tổng bài tập đã xuất bản) và contest đang / sắp diễn ra. |
| FR-B6 | S | Nhân bản khoá: sao chép toàn bộ chương, mục, testcase sang khoá mới ở trạng thái Nháp; không sao chép member và bài nộp. Phục vụ mở lại khoá mỗi kỳ. |
| FR-B7 | S | Lưu trữ khoá: ẩn khỏi danh sách của member, mentor/admin vẫn xem được lịch sử và tiến độ. |

### FR-C · Nội dung khoá học

| ID | Ưu tiên | Yêu cầu |
|---|:-:|---|
| FR-C1 | M | Khoá gồm các chương có thứ tự; chương gồm các mục có thứ tự. Sắp xếp bằng nút lên/xuống (M) hoặc kéo thả (S). Di chuyển mục sang chương khác. |
| FR-C2 | M | Bài đọc: tiêu đề + nội dung Markdown; hỗ trợ code block có tô màu cú pháp, ảnh tải lên, bảng. Công thức LaTeX (S). |
| FR-C3 | M | Mỗi mục có trạng thái *Nháp / Xuất bản*; member chỉ thấy mục đã xuất bản. Mentor xem trước đúng như member sẽ thấy. |
| FR-C4 | S | Lịch mở: mục có thể đặt thời điểm bắt đầu hiện với member. |
| FR-C5 | C | Điều kiện mở: phải AC bài trước mới mở bài sau. |

### FR-D · Bài tập & testcase

| ID | Ưu tiên | Yêu cầu |
|---|:-:|---|
| FR-D1 | M | Bài tập gồm: tiêu đề; đề bài Markdown (code block, LaTeX ở mức S); mô tả input, output, ràng buộc; ít nhất một ví dụ input/output kèm giải thích; giới hạn thời gian (ms) và bộ nhớ (MB) — mặc định theo cấu hình hệ thống, ghi đè được theo bài; độ khó; thẻ (tag). |
| FR-D2 | M | Ngôn ngữ cho phép của bài là tập con của ngôn ngữ đã bật ở hệ thống. Hệ số thời gian theo ngôn ngữ (ví dụ Python ×3) cấu hình ở mức hệ thống. |
| FR-D3 | S | Code khởi tạo (starter code) riêng cho từng ngôn ngữ. |
| FR-D4 | M | Testcase: nhiều testcase, mỗi cái có input, expected output, cờ *mẫu / ẩn*, trọng số (số dương, mặc định 1 cho mỗi testcase), thứ tự. Nhập tay từng cái **hoặc** tải lên hàng loạt bằng file zip theo quy ước `01.in` / `01.out`. Mỗi file input/expected output nhận tối đa 10 MB; zip tải lên tối đa 64 MB; tổng dung lượng testcase mỗi bài tối đa 128 MB; vượt giới hạn thì báo lỗi nêu rõ file nào vượt. |
| FR-D5 | M | Cách so sánh output: mặc định chuẩn hoá CRLF/CR thành LF ở cả hai phía, bỏ qua khoảng trắng cuối dòng và dòng trống cuối; tuỳ chọn so sánh chính xác tuyệt đối (S); so sánh số thực với sai số (C); checker tự viết (C). |
| FR-D6 | M | **Kiểm tra testcase bằng lời giải mẫu**: mentor dán lời giải, hệ thống chạy toàn bộ testcase và báo testcase nào không khớp trước khi xuất bản. Tự sinh expected output từ lời giải mẫu cho các testcase chỉ có input (S). Xuất bản không bị chặn, nhưng nếu bài chưa từng được kiểm hoặc lần kiểm gần nhất thất bại thì phải xác nhận qua hộp thoại cảnh báo. |
| FR-D7 | M | Lời giải tham khảo lưu kèm bài, chỉ mentor/admin xem. Cho member xem sau khi AC hoặc sau khi contest kết thúc (S). |
| FR-D8 | S | Bài tập dùng chung giữa nhiều khoá và contest (tham chiếu tới cùng một bài, không sao chép), để sửa testcase một nơi. |
| FR-D9 | S | Chấm lại (rejudge) toàn bộ bài nộp của một bài sau khi sửa testcase; kết quả cũ được giữ trong lịch sử; bảng xếp hạng contest tính lại theo. |
| FR-D10 | S | **Bài dạng function (kiểu LeetCode)**: người học chỉ viết một hàm theo chữ ký cho sẵn, không viết `main`. Mentor soạn *harness* riêng cho từng ngôn ngữ; hệ thống ghép harness với mã người học rồi biên dịch thành một chương trình, sau đó chấm y như bài stdio. Ngôn ngữ chưa có harness thì không nộp bằng ngôn ngữ đó được, và bài dạng này bắt buộc có harness cho ít nhất một ngôn ngữ. Harness không bao giờ lộ ra cho member. |

### FR-E · Giao diện làm bài (split view)

| ID | Ưu tiên | Yêu cầu |
|---|:-:|---|
| FR-E1 | M | Màn hình làm bài gồm **ba vùng**: **thanh icon điều hướng bên trái** (FR-E7, rộng 48 px) và hai khung chia phần còn lại: **nội dung** — **trình soạn code**. Vạch chia giữa hai khung kéo được bằng chuột và cảm ứng; mỗi khung có chiều rộng tối thiểu 320 px; tỉ lệ được nhớ cho lần sau trên cùng trình duyệt. |
| FR-E2 | M | Thu gọn / mở lại từng khung bằng nút; nhấp đúp vạch chia để về tỉ lệ mặc định 50/50. Hai nút này dùng được bằng bàn phím; vạch chia chỉnh được bằng phím mũi tên khi focus. |
| FR-E3 | M | Khung nội dung (khung đầu) có tab: **Đề bài** · **Bài nộp** (lịch sử của tôi) · với mentor/admin thêm **Testcase** (xem và soạn testcase của bài đang mở — FR-D4, FR-D6) · **Thống kê** (phân bố verdict, số lượt nộp của bài đang mở). Bảng xếp hạng không phải tab ở đây mà mở từ thanh icon (FR-E7). |
| FR-E4 | M | Khung phải: chọn ngôn ngữ (nhớ lựa chọn gần nhất); editor có tô màu cú pháp, số dòng, thụt lề tự động, Tab/Shift+Tab, tìm kiếm, undo/redo, chủ đề sáng/tối; nút **Chạy thử**, **Nộp bài**, **Đặt lại code khởi tạo** (có xác nhận). |
| FR-E5 | M | Dưới editor là bảng điều khiển kéo cao/thấp được, gồm tab **Chạy thử** (input tự nhập, stdout, stderr, thời gian, bộ nhớ) và **Kết quả** (verdict từng testcase của **lần nộp đang xem** — là bài nộp được chọn trong tab **Bài nộp** (FR-E3), mặc định bài mới nhất; khi bấm **Nộp bài**, bài mới tự trở thành lần nộp đang xem và bảng điều khiển mở tab **Kết quả**, cập nhật trực tiếp theo FR-F4). Tab **Bài nộp** chỉ hiển thị danh sách lịch sử với verdict tổng; chi tiết từng testcase xem ở tab **Kết quả**. |
| FR-E6 | M | Code đang gõ tự lưu nháp theo (người dùng, bài, ngôn ngữ), chậm nhất 2 giây sau lần gõ cuối — không mất khi reload hoặc đóng tab. Trình duyệt giữ tối đa 50 nháp gần nhất mỗi người dùng; khi vượt, nháp cũ nhất bị xoá và có thông báo. Đồng bộ nháp lên server để làm tiếp ở máy khác (S — một nháp mới nhất cho mỗi (bài, ngôn ngữ)). |
| FR-E7 | M | **Thanh icon (icon rail)** cố định bên trái, **chỉ gồm icon kèm tooltip** khi rê chuột (trên thiết bị cảm ứng: chạm icon vừa chuyển mục vừa hiện nhãn tạm trong vài giây; icon focus được bằng Tab, tooltip hiện khi focus, mỗi icon có nhãn cho trình đọc màn hình): **Mô tả** (trong màn hình contest là mô tả contest, ngoài contest là giới thiệu khoá) · **Giáo trình** · **Bảng xếp hạng** (FR-G6, FR-I5) · **Trợ giúp** (FR-E11); mentor/admin có thêm **một** icon **Quản trị** — mở khu quản trị cấp khoá/contest ở khung đầu: soạn chương mục (FR-C1), bảng tiến độ khoá (FR-G4), thống kê contest (FR-I7) *(S — bổ sung của tài liệu, chưa chốt với BCN)*. **Bấm icon đổi nội dung khung đầu tiên** sang mục tương ứng. Khung đầu có hai chế độ: (a) *chế độ mục* — Mô tả / Giáo trình / Bảng xếp hạng / Trợ giúp chiếm toàn khung, không có dải tab FR-E3, icon tương ứng được tô sáng; (b) *chế độ bài* — hiển thị dải tab FR-E3 của bài đang mở, không icon nào được tô sáng. Bấm một icon bất kỳ chuyển sang chế độ mục; mục và bài đang chọn được nhớ theo trình duyệt, giữ qua reload. Icon **Bảng xếp hạng** hiển thị theo ngữ cảnh: trong màn hình contest là bảng xếp hạng contest (FR-I5), ngoài contest là bảng xếp hạng khoá (FR-G6). **Giáo trình** hiển thị cây chương/mục của khoá (hoặc danh sách bài contest) kèm trạng thái *Chưa làm / Đã thử / Đã AC*; chọn một bài chuyển khung đầu sang chế độ bài, mở tab **Đề bài** của bài đó, kèm nút *Bài trước / Bài sau*. |
| FR-E8 | S | Phím tắt: Ctrl/⌘+Enter chạy thử, Ctrl/⌘+Shift+Enter nộp bài. Chế độ editor toàn màn hình. |
| FR-E9 | M | Màn hình hẹp (< 900px): thanh icon giữ nguyên (đã đủ hẹp); hai khung chuyển thành hai tab *Nội dung / Code* thay vì split; nhãn tab Nội dung đổi theo mục đang hiển thị (*Đề bài / Giáo trình / Bảng xếp hạng / Trợ giúp / Mô tả*); bấm icon khi đang ở tab Code chuyển về tab Nội dung và hiển thị mục tương ứng; mọi chức năng vẫn dùng được. |
| FR-E10 | S | Bài đọc hiển thị một cột toàn chiều rộng; có nút bật editor nháp ở khung phải để member thử code trong lúc đọc. |
| FR-E11 | M | Mục **Trợ giúp** trên thanh icon: trang trợ giúp tiếng Việt giải thích cách làm bài và nộp, ý nghĩa từng verdict (`AC`/`WA`/`TLE`/…), phím tắt, quy ước đọc input / ghi output theo từng ngôn ngữ; mentor/admin có thêm hướng dẫn soạn bài và testcase. |

### FR-F · Chạy thử & nộp bài

| ID | Ưu tiên | Yêu cầu |
|---|:-:|---|
| FR-F1 | M | **Chạy thử**: biên dịch và chạy với (a) tất cả testcase mẫu hoặc (b) input tự nhập. Trả về stdout, stderr, thông báo lỗi biên dịch nguyên văn (tối đa 64 KB đầu, kèm ghi chú khi bị cắt bớt), thời gian, bộ nhớ. Không lưu vào lịch sử nộp. |
| FR-F2 | M | **Nộp bài**: chạy toàn bộ testcase (mẫu + ẩn). Mỗi testcase có verdict, thời gian, bộ nhớ. Verdict tổng là `AC` khi mọi testcase `AC`, ngược lại là verdict của testcase lỗi đầu tiên. Điểm bài = (tổng trọng số testcase `AC` ÷ tổng trọng số mọi testcase của bài) × 100, làm tròn 2 chữ số thập phân. **v0.8:** điểm **tích luỹ** (tiến độ, bảng xếp hạng khoá/toàn ban/team) = tỉ lệ đó × **điểm tối đa của bài theo độ khó** — Dễ / Trung bình / Khó / Chưa đặt do admin cấu hình (mặc định 100 / 150 / 200 / 100); đề bài hiện điểm tối đa cạnh độ khó. |
| FR-F3 | M | Với testcase **ẩn**, member chỉ thấy verdict, thời gian, bộ nhớ — không bao giờ thấy input hay expected output. Với testcase **mẫu** bị `WA`, hiển thị diff giữa output mong đợi và output thực tế (cắt gọn còn 100 dòng khác biệt đầu hoặc 64 KB, kèm ghi chú khi bị cắt). |
| FR-F4 | M | Trạng thái nộp cập nhật trực tiếp `PENDING → RUNNING → kết quả`, từng testcase một, không cần reload; mỗi thay đổi hiển thị ở client ≤ 2 giây sau khi có ở server. |
| FR-F5 | M | Giới hạn cấu hình được: kích thước source (mặc định 64 KB), input tự nhập (64 KB), output mỗi lần chạy (mặc định 8 MB), số lần nộp mỗi phút mỗi người (mặc định 6), số lần chạy thử mỗi phút mỗi người (mặc định 6). Mỗi người tối đa một bài nộp `RUNNING` và một lượt chạy thử đang thực thi tại một thời điểm (quy tắc lập lịch — bài của cùng người chấm tuần tự); bài nộp mới vẫn được nhận và xếp `PENDING`, tối đa 3 bài `PENDING` mỗi người (nộp vượt bị từ chối kèm thông báo, cấu hình được). |
| FR-F6 | M | Hàng đợi chấm công bằng theo thứ tự đến; lượt chạy thử vào cùng hàng đợi nhưng bài nộp được ưu tiên khi có cả hai — chấp nhận cài đặt theo băng slot có luật chống đói: một slot có thể ưu tiên chạy thử, nhưng khi bài nộp chờ lâu nhất vượt 20 giây thì mọi slot phục vụ bài nộp. Hiển thị "đang xếp hàng, N bài phía trước" khi phải đợi (S). |
| FR-F7 | M | Ngôn ngữ bắt buộc ở v1: **C (C11, GCC)**, **C++ 17 (GCC)**, **Python 3**. Nên có (S): **Java 17**, **JavaScript (Node 20)**. Thêm ngôn ngữ mới bằng cấu hình, không phải sửa code ứng dụng. |
| FR-F8 | M | Bài nộp bị `IE` (lỗi hệ thống) không tính vào lượt của member, được tự động chấm lại khi judge hoạt động trở lại. |
| FR-F9 | S | Chạy thử được hủy bởi người dùng khi đang chờ. |

### FR-G · Kết quả, lịch sử, tiến độ

| ID | Ưu tiên | Yêu cầu |
|---|:-:|---|
| FR-G1 | M | Member xem lịch sử nộp của mình theo bài: thời điểm, ngôn ngữ, verdict, điểm, thời gian, bộ nhớ; mở lại source và **nạp lại vào editor**. |
| FR-G2 | M | Mỗi bài tập hiển thị trạng thái với member: *Chưa làm / Đã thử / Đã AC*; khoá hiển thị tiến độ tổng. |
| FR-G3 | M | Mentor xem mọi bài nộp trong khoá / contest, lọc theo member / bài / verdict / ngôn ngữ / thời gian; mở source. |
| FR-G4 | M | Bảng tiến độ khoá: ma trận member × bài tập với trạng thái tốt nhất và số lần nộp; xuất CSV (S). |
| FR-G5 | S | Mentor để lại nhận xét trên một bài nộp; member thấy thông báo trong app. |
| FR-G6 | M | **Bảng xếp hạng khoá học** (mục *Bảng xếp hạng* trên thanh icon): xếp member theo **tổng điểm tích luỹ** trong khoá (tổng điểm bài tốt nhất mỗi bài theo FR-F2 v0.8), hoà thì số bài AC, rồi ai đạt sớm hơn — **v0.8 đổi từ "AC trước" sang "điểm trước"**, vì bài khó đáng nhiều điểm hơn mà xếp AC trước thì hệ số vô nghĩa; BXH toàn ban và team cùng thứ tự; cập nhật khi có verdict mới. Contest dùng bảng xếp hạng riêng theo FR-I5. |
| FR-G7 | C | Phát hiện trùng code cơ bản giữa các member trong cùng bài. |

### FR-H · Quản trị hệ thống

| ID | Ưu tiên | Yêu cầu |
|---|:-:|---|
| FR-H1 | M | Cấu hình ngôn ngữ chấm: tên hiển thị, phiên bản, lệnh biên dịch, lệnh chạy, phần mở rộng file, bật/tắt, hệ số thời gian. |
| FR-H2 | M | Giới hạn mặc định toàn hệ thống (đều cấu hình được): giới hạn thời gian 1000 ms, bộ nhớ 256 MB, wall time = 2 × giới hạn thời gian + 2 s, ≤ 64 tiến trình, ghi đĩa qua tmpfs `/tmp` 16 MB + thư mục làm việc 64 MB (tính vào giới hạn bộ nhớ), output ≤ 8 MB mỗi lần chạy, kích thước source 64 KB, số lần nộp/phút 6, số lần chạy thử/phút 6. |
| FR-H3 | M | Trang tình trạng chấm: số bài đang chờ, đang chạy, worker hoạt động, danh sách bài `IE` và nút chấm lại. |
| FR-H4 | S | Nhật ký hành động quản trị: ai sửa bài / testcase / vai trò / ghi danh / contest, khi nào, thay đổi gì. |
| FR-H5 | S | Thông báo toàn hệ thống dạng banner (ví dụ "bảo trì 22:00"). |

### FR-I · Contest theo tuần

| ID | Ưu tiên | Yêu cầu |
|---|:-:|---|
| FR-I1 | M | Contest là một **chuỗi bài tập có thứ tự** với thời điểm bắt đầu và kết thúc (mặc định 7 ngày), thuộc một khoá học **hoặc** toàn ban (mọi member). Trạng thái suy ra từ thời gian: *Sắp diễn ra / Đang diễn ra / Đã kết thúc*. |
| FR-I2 | M | Mentor (trong khoá) hoặc admin (toàn CLB) tạo contest: tên, mô tả, khung thời gian, chọn bài từ khoá hoặc ngân hàng bài (hoặc soạn bài mới), đặt thứ tự và điểm tối đa mỗi bài. Contest ở trạng thái Nháp cho tới khi xuất bản. |
| FR-I3 | M | Trước giờ bắt đầu, member thấy contest trong danh sách (tên, khung thời gian, số bài, đếm ngược) và vào được màn hình contest: khung đầu hiển thị Mô tả contest kèm đếm ngược, Giáo trình hiển thị số bài ở trạng thái khoá, khung editor trống — nhưng **không thấy đề**; server không bao giờ trả đề trước thời điểm bắt đầu. Đề hiển thị trong vòng ≤ 5 giây sau thời điểm bắt đầu mà không cần reload. |
| FR-I4 | M | Trong contest, member làm bài bằng đúng màn hình split view; bài nộp gắn với contest. Chỉ bài nộp **trong khung thời gian** mới tính vào bảng xếp hạng. |
| FR-I5 | M | Bảng xếp hạng: xếp theo tổng điểm (điểm mỗi bài = tỉ lệ trọng số testcase `AC` cao nhất trong các bài nộp thuộc khung thời gian contest × điểm tối đa của bài, làm tròn 2 chữ số thập phân); hoà thì người đạt điểm cuối cùng sớm hơn xếp trên. Cập nhật trực tiếp. Member thấy hạng của mình và toàn bảng. |
| FR-I6 | M | Sau khi kết thúc, contest chuyển sang **chế độ luyện tập**: vẫn nộp được và được chấm, nhưng bảng xếp hạng không đổi; bảng xếp hạng cuối xem lại được. Màn hình làm bài hiển thị rõ trạng thái *Chế độ luyện tập — bài nộp không tính vào bảng xếp hạng* (badge cạnh nút Nộp bài). |
| FR-I7 | M | Mentor xem thống kê contest: số người tham gia (có ít nhất một bài nộp), danh sách chưa nộp, phân bố verdict theo bài; xuất CSV (S). |
| FR-I8 | S | Tuỳ chọn **chuỗi tuần tự** cho từng contest: phải AC bài trước mới mở bài sau (mặc định tắt). |
| FR-I9 | S | Nhân bản contest tuần trước làm khung cho tuần sau (giữ cấu hình, dời khung thời gian +7 ngày, danh sách bài để trống để chọn bài mới — khớp US-10). |
| FR-I10 | S | Đóng băng bảng xếp hạng N phút cuối (mentor bật); mở lại sau khi kết thúc. |
| FR-I11 | C | Lịch tự động: tạo contest mới mỗi tuần theo mẫu và nhắc mentor bổ sung bài. |

### FR-J · Team & Leader

| ID | Ưu tiên | Yêu cầu |
|---|:-:|---|
| FR-J1 | M | Admin tạo / sửa / xoá team (tên, mô tả); xếp member vào team — mỗi member thuộc **tối đa một team**; gán đúng **một leader** là thành viên của team; đổi leader bất kỳ lúc nào. Xoá team hay gỡ thành viên không ảnh hưởng bài nộp và tiến độ. |
| FR-J2 | M | Leader xem **bảng tiến độ team**: ma trận thành viên × bài tập theo từng khoá mà thành viên ghi danh (trạng thái tốt nhất, số lần nộp, điểm theo FR-F2), và tình trạng contest đang diễn ra (ai đã nộp / chưa nộp, điểm hiện tại). |
| FR-J3 | M | Leader xem **danh sách bài nộp** của thành viên team: lọc theo thành viên / bài / verdict / thời gian, mở source — **chỉ đọc**: không sửa, không chấm lại, không thấy testcase ẩn hay lời giải tham khảo (NFR-2 giữ nguyên). Đề bài chỉ mở được khi chính leader có quyền xem khoá/contest đó. Với bài nộp thuộc **contest đang diễn ra**, leader thấy verdict và điểm nhưng **source chỉ mở sau khi contest kết thúc** — chống chép bài trong contest (bổ sung theo `design.md` §14 Delta v0.7). |
| FR-J4 | S | Trang "Team của tôi" cho mọi thành viên team: danh sách thành viên, leader, tiến độ tổng quan (số bài AC của từng người trong các khoá chung). |
| FR-J5 | S | Bảng xếp hạng contest lọc / nhóm được theo team; bảng tổng hợp theo team (tổng điểm, số bài AC của thành viên). |
| FR-J6 | S | Leader để lại ghi chú nhắc nhở cho một thành viên (hiện trong app của thành viên đó); mentor/admin xem được các ghi chú này. |

## 6. Yêu cầu phi chức năng

| ID | Ưu tiên | Yêu cầu |
|---|:-:|---|
| NFR-1 **Cách ly chấm bài** | M | Code của member chạy trong môi trường cách ly (Docker có sẵn trên server): không truy cập mạng, không thấy file hệ thống hay bài nộp khác, bị giới hạn CPU time, wall time, RAM, số tiến trình, dung lượng ghi và kích thước output. Mỗi lần chạy dùng môi trường sạch và **chắc chắn bị huỷ** khi vượt giới hạn (kể cả fork bomb, sleep vô hạn, in vô hạn). Giá trị mặc định của từng giới hạn theo FR-H2. |
| NFR-2 **Bảo vệ testcase ẩn** | M | Input và expected output của testcase ẩn không bao giờ đi tới client của member qua bất kỳ API, thông báo lỗi hay diff nào. Có test tự động canh điều này (bài học từ `serialize/question.ts` của iexam). |
| NFR-3 **Phân quyền phía server** | M | Mọi kiểm tra quyền thực hiện ở server theo ma trận mục 3; giao diện chỉ ẩn/hiện. Có test cho từng ô "–" trong ma trận. Đề bài contest chưa bắt đầu cũng là dữ liệu ẩn. |
| NFR-4 **Hiệu năng** | M | Bài chuẩn đo: source ≤ 100 dòng, input mỗi testcase ≤ 1 KB, giới hạn 1 giây/testcase; mọi mục tiêu đo trên VPS triển khai thực tế (đề xuất tối thiểu 4 vCPU / 8 GB RAM — BCN chốt theo VPS thật). Khi hàng đợi rỗng: chạy thử bài chuẩn đo 1 testcase trả kết quả ≤ 3 giây với C và Python (gồm cả biên dịch C); với C++ tổng thời gian gồm biên dịch ≤ 10 giây. Hàng đợi xử lý ≥ 40 bài nộp/phút với 2 worker (hồ sơ tải chuẩn: bài 10 testcase, lời giải AC bằng C++, image ngôn ngữ có sẵn), mở rộng bằng cách thêm worker. Thời gian chờ chấm p95 ≤ 60 giây, tính cả tải chạy thử, khi mô phỏng tải giờ đầu contest theo giả định mục 2 / Q14 (40 người nộp cùng lúc, ~40 bài/phút, 2 worker); tới 300 member hoặc nếu Q14 chốt giờ thi tập trung, giữ mục tiêu p95 nhưng tính lại số worker theo tải đỉnh (ước lượng mỗi 20 bài nộp/phút cần thêm 1 worker). Khi cấu hình một bài khiến ngân sách chấm tối đa (biên dịch + Σ giới hạn thời gian × hệ số ngôn ngữ) vượt 60 giây, hệ thống cảnh báo mentor lúc soạn bài. Bảng xếp hạng **contest** cập nhật ≤ 5 giây sau khi có verdict; bảng xếp hạng khoá được phép trễ tới ~15 giây. Mở màn hình làm bài ≤ 2 giây (p95, từ lần mở thứ hai trên cùng trình duyệt, mạng trong nước). |
| NFR-5 **Độ tin cậy** | M | Bài nộp đã nhận không bao giờ mất. Worker chết giữa chừng → bài quay lại hàng đợi. Khi judge tạm ngưng, member vẫn đọc đề, lưu nháp; chỉ nút Nộp báo "đang bảo trì". Bài nộp sát giờ kết thúc contest được tính theo **thời điểm nhận**, không phải thời điểm chấm xong. |
| NFR-6 **Khả dụng** | M | Giao diện tiếng Việt. Desktop-first (tối ưu ≥ 1280px), dùng được trên tablet, mobile ở chế độ tab. Các thao tác sau làm được chỉ bằng bàn phím: đăng nhập, chuyển tab khung nội dung, chuyển mục thanh icon, soạn code, chạy thử, nộp bài, điều hướng giáo trình, đóng/mở khung. Chủ đề sáng/tối. |
| NFR-7 **Dữ liệu** | M | Sao lưu DB và testcase hằng ngày. Source của mọi bài nộp lưu ít nhất 2 năm. |
| NFR-8 **Tương thích** | M | Chrome, Edge, Firefox, Safari — hai phiên bản gần nhất; Safari iOS ≥ 15 chỉ cần đọc được đề, kết quả và bảng xếp hạng — mốc phiên bản do BCN chốt theo máy member (bài học `no-regex-lookbehind` của iexam). |
| NFR-9 **Bảo trì** | S | Thêm ngôn ngữ chấm = thêm cấu hình + môi trường chạy, không sửa code ứng dụng. |
| NFR-10 **Quan sát** | S | Ghi log mỗi lượt chấm (thời gian chờ, thời gian chạy, worker); cảnh báo khi hàng đợi vượt ngưỡng hoặc worker chết. |

## 7. User story & tiêu chí chấp nhận

**US-1 · Admin mở khoá học mới và giao cho mentor**
*Là admin, tôi muốn tạo khoá "C cơ bản K12" và gán mentor A để mentor tự soạn nội dung.*
- Cho admin đã đăng nhập, khi tạo khoá với tên và mã, thì khoá xuất hiện ở trạng thái Nháp và chưa member nào thấy.
- Khi gán mentor A, thì A thấy khoá trong mục "Khoá tôi phụ trách" và có quyền soạn nội dung.
- Khi ghi danh 40 member bằng cách dán danh sách email, thì email không tồn tại được liệt kê để admin xử lý, số còn lại được ghi danh.

**US-2 · Mentor soạn bài tập và tự kiểm tra testcase**
*Là mentor, tôi muốn đăng bài "Tổng hai số" với 2 testcase mẫu và 8 testcase ẩn, và chắc chắn testcase đúng trước khi member thấy.*
- Cho bài ở trạng thái Nháp, khi tải lên zip `01.in…10.out`, thì 10 testcase được tạo đúng thứ tự, mặc định là ẩn. Khi tôi đánh dấu testcase 1–2 là mẫu, thì member sẽ chỉ thấy đúng hai testcase đó.
- Khi dán lời giải mẫu C và bấm "Kiểm tra", thì hệ thống báo 10/10 khớp; nếu testcase 7 sai expected output, thì báo rõ testcase 7 kèm diff.
- Khi bấm Xuất bản, thì member trong khoá thấy bài, còn testcase 3–10 không xuất hiện trong bất kỳ phản hồi nào tới member.

**US-3 · Member làm bài trong split view**
*Là member, tôi muốn điều hướng bằng thanh icon bên trái, đọc đề ở giữa và code bên phải, kéo vạch chia theo ý.*
- Khi mở bài tập trên màn hình 1440px, thì thanh icon hiện bên trái, khung giữa hiển thị đề bài, khung phải hiển thị editor với ngôn ngữ tôi dùng lần trước.
- Khi rê chuột lên một icon, thì tooltip hiện tên mục (ví dụ "Bảng xếp hạng").
- Khi bấm icon Bảng xếp hạng, thì khung đầu chuyển sang bảng xếp hạng còn editor và code đang gõ giữ nguyên; bấm một bài trong Giáo trình thì khung đầu quay về đề bài của bài đó.
- Khi kéo vạch chia đến 30/70 rồi reload, thì tỉ lệ vẫn là 30/70; khung không nhỏ hơn chiều rộng tối thiểu.
- Khi thu cửa sổ xuống 800px, thì hai khung chuyển thành hai tab Nội dung / Code (thanh icon vẫn giữ), code đang gõ không mất; đang ở tab Code mà bấm icon Bảng xếp hạng thì chuyển về tab Nội dung hiển thị bảng xếp hạng.

**US-4 · Member chạy thử**
*Là member, tôi muốn chạy code với ví dụ trong đề và với input tự nhập trước khi nộp.*
- Khi bấm Chạy thử, thì mỗi testcase mẫu hiển thị output thực tế cạnh output mong đợi và đánh dấu khớp/không khớp.
- Khi nhập input tự chọn và chạy, thì thấy stdout, stderr, thời gian; lỗi biên dịch hiển thị nguyên văn của compiler.
- Khi code chạy vô hạn, thì sau giới hạn thời gian nhận `TLE`, giao diện không treo.

**US-5 · Member nộp bài và xem verdict từng testcase**
- Khi bấm Nộp bài, thì bài xuất hiện ở đầu danh sách tab Bài nộp với verdict tổng `PENDING`, đồng thời bảng điều khiển dưới editor mở tab Kết quả và từng testcase chuyển sang verdict mà không cần reload.
- Khi testcase ẩn số 6 sai, thì tôi thấy `WA` ở testcase 6 kèm thời gian, nhưng không thấy input/expected của nó.
- Khi tất cả AC, thì bài được đánh dấu Đã AC trong danh sách mục và tiến độ khoá tăng.
- Khi nộp lần thứ 7 trong một phút, thì bị từ chối với thông báo còn bao lâu được nộp tiếp.

**US-6 · Không thể lấy testcase ẩn**
*Là admin, tôi cần chắc chắn member không moi được testcase ẩn.*
- Khi member gọi bất kỳ API nào liên quan bài tập / bài nộp / kết quả, thì phản hồi không chứa input hay expected output của testcase ẩn.
- Khi code của member cố đọc thư mục testcase hoặc gọi mạng, thì thao tác đó thất bại (không đọc được dữ liệu, không gói tin nào ra ngoài); chương trình vẫn được chấm bình thường theo output.

**US-7 · Mentor theo dõi tiến độ khoá**
- Khi mở Thống kê khoá, thì thấy ma trận member × bài với trạng thái tốt nhất và số lần nộp; lọc được "chưa AC bài X".
- Khi bấm vào một ô, thì thấy danh sách bài nộp của member đó cho bài đó và mở được source.

**US-8 · Admin thêm ngôn ngữ chấm mới**
- Khi thêm ngôn ngữ "Go 1.22" với lệnh biên dịch/chạy và bật lên, thì mentor thấy Go trong danh sách ngôn ngữ cho phép của bài mà không cần deploy lại ứng dụng.

**US-9 · Sandbox chống code phá hoại**
- Khi member nộp fork bomb, code ghi 1 GB ra đĩa, hoặc cấp phát vượt bộ nhớ, thì worker vẫn sống, bài nhận `RE`/`MLE`, các bài nộp sau vẫn được chấm bình thường.

**US-10 · Mentor tạo contest tuần**
*Là mentor, tôi muốn mỗi tuần ghép 5 bài thành một contest mở từ 20:00 thứ Hai đến 20:00 thứ Hai tuần sau.*
- Khi tạo contest và chọn 5 bài từ ngân hàng bài, đặt điểm 100 mỗi bài và khung thời gian, thì contest ở trạng thái Nháp, chưa member nào thấy.
- Khi xuất bản, thì member trong phạm vi contest thấy nó trong mục "Sắp diễn ra" kèm đếm ngược, nhưng không thấy đề.
- Khi nhân bản contest tuần trước (S), thì được contest mới với khung thời gian +7 ngày và danh sách bài trống để thay.

**US-11 · Member thi contest tuần**
- Cho contest bắt đầu 20:00, khi member đang mở màn hình contest lúc 19:59, thì trong vòng 5 giây sau 20:00 danh sách bài mở ra mà không cần reload.
- Khi member AC bài 2 lúc 20:31, thì bảng xếp hạng cập nhật điểm và thời điểm 20:31 trong ≤ 5 giây (NFR-4); người cùng điểm nhưng đạt sớm hơn xếp trên.
- Khi contest kết thúc và member nộp tiếp, thì bài vẫn được chấm và hiện trong lịch sử, nhưng bảng xếp hạng không đổi.
- Khi bài nộp gửi lúc 19:59:58 (trước giờ kết thúc) nhưng chấm xong lúc 20:00:10, thì vẫn tính vào bảng xếp hạng.

**US-12 · Leader theo dõi team**
*Là leader team Alpha, tôi muốn biết ai trong team đang đuối để kịp nhắc.*
- Cho tôi là leader, khi mở trang Team, thì thấy ma trận tiến độ các thành viên theo từng khoá và tình trạng nộp contest tuần này (ai chưa nộp).
- Khi bấm vào một thành viên, thì thấy lịch sử bài nộp của người đó và mở được source; giao diện không có nút sửa hay chấm lại nào.
- Khi tôi không có quyền xem khoá X, thì với bài nộp thuộc khoá X tôi vẫn thấy verdict, điểm, source nhưng không mở được đề bài.
- Khi một member thường mở trang team khác hoặc gọi API tiến độ của team khác, thì bị từ chối (403).

## 8. Phạm vi

**v1** = mọi yêu cầu mức **M**. Về mặt sản phẩm, v1 xong khi: admin tạo khoá và tài khoản; mentor đăng bài + testcase và kiểm tra bằng lời giải mẫu; member làm bài trong split view với C, C++ và Python, nhận verdict từng testcase; mentor ghép bài thành contest tuần, member thi và xem bảng xếp hạng; mentor xem tiến độ; leader theo dõi tiến độ và bài nộp của team mình.

**Ngoài v1** (mức C hoặc chưa liệt kê): phát hiện trùng code, đăng nhập Google, checker tự viết, thông báo email, lịch tự tạo contest, chấm bài tự luận, ứng dụng di động.

## 9. Đánh giá khả thi & tái sử dụng từ workspace

Kết quả rà soát `imath-test`, `question-generator`, `skill-bank` (chỉ là thực trạng để ước lượng rủi ro; quyết định dùng gì thuộc bước design).

| Mảng | Thực trạng | Ý nghĩa với bcn-judge |
|---|---|---|
| Đăng nhập, phiên, vai trò | `imath-test/server/src/auth/` — session token mờ (không JWT), argon2id, middleware `requireAuth/requireAdmin/requireTeacher`, luồng bắt đổi mật khẩu lần đầu, nhập tài khoản. ~150 dòng lõi, phụ thuộc chỉ `pg` + Hono. | **Tái sử dụng gần như nguyên vẹn**; FR-A gần như có sẵn. Chỉ cần thêm vai trò *mentor/member* và quyền theo khoá. |
| Khoá học, ghi danh | `classrooms` + `classEnrollments` (giáo viên → lớp → học sinh, mã tham gia), `bankCategories` + `bankQuestions` (cây danh mục → câu hỏi). | Mô hình tương đương FR-B; nhưng chưa có khái niệm "khoá chứa nhiều bài, bài thuộc nhiều khoá" (FR-D8) hay contest. |
| Bài nộp, kết quả | `examSessions` + `sessionAnswers` + `scoreRecomputeAudit` (chấm lại có audit). | Mẫu tham khảo cho FR-G và FR-D9, không dùng trực tiếp. |
| Bảo vệ dữ liệu ẩn | `server/src/serialize/question.ts` + test canh đáp án không rời server. | Đúng mẫu cần cho NFR-2 (testcase ẩn) và đề contest chưa mở. |
| Render Markdown + LaTeX | `src/components/math/{rendering,loadKatex,katexOptions,sanitize}.ts` — `marked` + KaTeX + DOMPurify, 4 file độc lập. | **Tái sử dụng được** cho FR-C2 / FR-D1. |
| Trình soạn code | **Không có** Monaco / CodeMirror / Ace ở bất kỳ project nào. Tiptap của `iexam-editor` là rich-text, thiên về đề thi. | Editor code (FR-E4) làm mới. |
| Split pane kéo được | **Không có** thư viện hay component nào; chỉ có grid tĩnh. | FR-E1/E2/E5 làm mới. |
| Chạy code cách ly | **Không có** bất kỳ `child_process`/sandbox nào ở server. Docker, blue/green, Caddy, script VPS đã chín. | **Rủi ro lớn nhất của dự án** (NFR-1, NFR-4, NFR-5). Docker đã được xác nhận có trên server. |
| Giao diện | Tailwind v4 + bộ UI tự viết (`Button, Modal, Toast, Drawer…`), lucide, zustand, react-query; tiếng Việt viết thẳng trong JSX, không i18n. | Phù hợp NFR-6; `skill-bank/src/i18n` có sẵn nếu sau này cần song ngữ. |

Kết luận khả thi: khoảng **một phần ba** v1 (tài khoản, khoá, ghi danh, render nội dung, hạ tầng deploy) có sẵn mẫu để chuyển sang; **hai phần ba còn lại** (editor + split view, judge worker + sandbox + hàng đợi, giao diện soạn testcase, contest + bảng xếp hạng) là mới, trong đó sandbox là phần cần nguyên mẫu (prototype) sớm nhất để giảm rủi ro.

## 10. Câu hỏi mở

**Đã trả lời (31/08/2026)**

| # | Câu hỏi | Trả lời |
|---|---|---|
| Q1 | Ngôn ngữ bắt buộc ở v1? | Nguyên văn: "hỗ trợ cả C chuẩn" → **C chuẩn** vào nhóm bắt buộc cùng **C++, Python**; xếp Java/Node ở mức S là quyết định của tài liệu (FR-F7), BCN chưa xác nhận riêng |
| Q2 | Member tự đăng ký hay admin cấp? | **Admin cấp tài khoản** |
| Q3 | Server có Docker? | **Có** |
| Q4 | Contest trong v1? | **Có — contest theo tuần, mỗi contest là một chuỗi bài tập** (FR-I) |
| Q10 | Quy mô? | **120 member** hiện tại |

**Còn mở** — những câu đánh dấu ★ ảnh hưởng tới thiết kế contest, nên trả lời sớm; các câu khác đã có giả định an toàn.

| # | Câu hỏi | Giả định hiện tại |
|---|---|---|
| Q12 ★ | Contest thuộc **khoá học** hay **toàn ban**, hay cần cả hai? | Cả hai (FR-I1) |
| Q13 ★ | Cách xếp hạng: **tổng điểm + thời điểm đạt** (giả định), hay kiểu ICPC (số bài AC + penalty mỗi lần sai)? | Tổng điểm, hoà xét thời điểm (FR-I5) |
| Q14 ★ | Contest kéo dài **cả tuần** (làm lúc nào cũng được) hay có **giờ thi tập trung** 2–3 tiếng? Ảnh hưởng tải cao điểm và tính năng đóng băng bảng xếp hạng. | Cả tuần |
| Q15 | "Chuỗi bài tập" có nghĩa **mở tuần tự** (AC bài trước mới mở bài sau) không? | Không bắt buộc; là tuỳ chọn per contest (FR-I8) |
| Q5 | Member có được tự ghi danh vào khoá bằng mã không? | Mặc định khoá kín |
| Q6 | Điểm: chỉ cần AC/không AC, hay cần điểm theo tỉ lệ testcase và điểm tổng của khoá? | Cả hai: verdict + điểm theo trọng số |
| Q7 | Bài đọc (lý thuyết) có cần trong v1, hay khoá chỉ gồm bài tập? | Có, dạng Markdown |
| Q8 | Có cần LaTeX trong đề bài không? | S — nên có |
| Q9 | Bài tập có dùng chung giữa nhiều khoá / contest (ngân hàng bài) không? | S — cần cho contest nên gần như M |
| Q11 | Có cần hỗ trợ bài "tương tác" (đọc stdin từng dòng) hay chỉ batch stdin → stdout? | Chỉ batch |
| Q16 | Dự kiến tăng trưởng member 1–2 năm tới? Số mentor, admin thực tế? | Dự phòng tới 300 member; vài mentor, 1–3 admin |
| Q17 ★ | Team thuộc **toàn ban** hay theo **từng khoá học**? Một member có thể thuộc nhiều team không? Leader do admin gán hay mentor cũng gán được? | Toàn CLB; mỗi member ≤ 1 team; admin gán (FR-J1) |

## 11. Bước tiếp theo

1. `/sc:design bcn-judge` — kiến trúc, mô hình dữ liệu, API, cơ chế sandbox Docker và hàng đợi chấm, bảng xếp hạng contest, cùng quyết định tái sử dụng gì từ `imath-test` (mục 9). Kết quả ghi ở `docs/design.md`.
2. Nguyên mẫu sandbox chấm bài trước mọi thứ khác — đây là phần chưa có tiền lệ trong workspace.
3. BCN trả lời Q12–Q14 khi tiện; thiết kế contest được mô hình đủ mềm để đổi mà không phá schema.
4. `/sc:workflow` — kế hoạch triển khai theo giai đoạn.
