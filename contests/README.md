# Nạp contest từ đề .docx

Đề "Code C hằng tuần" được soạn tay trong Word rồi mới đưa vào hệ thống. Thư mục này
giữ mọi thứ đi kèm một tuần đề, trừ chính file .docx — file đó là bản của người ra đề
và **không bị sửa**.

```
contests/code-c-tuan-01/
  fix.json         đính chính: chỗ nào đề tự mâu thuẫn, sửa thành gì, và vì sao
  solutions/       lời giải mẫu bai-01.c … bai-10.c, dùng để máy chấm tự kiểm bộ test
```

## Chạy

```bash
cd server
# xem thử, không ghi gì:
npm run db:import:contest -- "../<đề>.docx" --data ../contests/code-c-tuan-01 --dry-run
# nạp thật, kèm chấm lời giải mẫu trên toàn bộ testcase (cần worker đang chạy):
npm run db:import:contest -- "../<đề>.docx" --data ../contests/code-c-tuan-01 --validate
```

| Cờ | Mặc định | |
|---|---|---|
| `--data <dir>` | — | thư mục chứa `fix.json` và `solutions/` |
| `--dry-run` | | in ra thứ đọc được rồi dừng |
| `--validate` | | xếp lời giải mẫu vào hàng đợi, chờ verdict thật |
| `--course <code>` | *không gắn khoá* | gắn contest vào một khoá (tự tạo nếu chưa có) |
| `--start` / `--end` | bây giờ / 23:59:59 thứ 7 tới | ISO 8601 |
| `--draft` | | tạo contest ở trạng thái nháp |
| `--author <email>` | admin đầu tiên | người đứng tên |
| `--language <id>` | `c11` | ngôn ngữ DUY NHẤT được nộp |
| `--reset` | | xoá contest cùng tên rồi nạp lại |

**Mặc định contest là của toàn CLB** (`course_id` NULL): mọi member thấy ngay, không
phải ghi danh ai. Chỉ thêm `--course` khi thật sự cần cổng ghi danh — và nhớ rằng trang
khoá chỉ vẽ **giáo trình**, không liệt kê contest, nên một khoá chỉ có contest sẽ hiện
"0 chương · 0 bài". Ngoài ra tiến độ khoá và điểm contest đếm riêng theo thiết kế
(design.md §2.7), nên đừng mong AC trong contest sẽ cộng vào tiến độ khoá.

`--reset` sẽ **hỏng** nếu đã có người nộp bài — FK `submissions.contest_id` không
cascade. Đó là cố ý: nạp đè một contest đang chạy sẽ thổi bay bảng xếp hạng, và cái
chốt ấy nên nằm ở DB chứ không nằm ở trí nhớ người chạy lệnh.

## Vì sao có `fix.json` thay vì sửa thẳng đề

Đề gõ tay thì có lỗi gõ tay. Tuần 1 có 5 ô sai trong 29 testcase — một đáp án tính
nhầm, ba chỗ viết hoa lệch với mô tả, một chỗ quên `%.2f`. Ba đường xử lý, chọn đường
thứ ba:

- **Sửa vào .docx** — tháng sau không ai biết đã sửa gì, và bản người ra đề gửi cho
  học viên lại khác bản máy chấm dùng.
- **Cho parser "đoán ý"** — tuần sau nó sửa nhầm một đề vốn đúng.
- **File đính chính riêng** — đọc được như một bản ghi chú, in ra mỗi lần nạp, và
  script từ chối chạy nếu đính chính trỏ vào ô mà đề gốc vốn đã đúng (dấu hiệu file
  fix đã lạc hậu).

Định dạng, `why` ở đâu cũng bắt buộc:

```json
{
  "dropRules": [
    { "from": "QUY ĐỊNH ĐỊNH DẠNG", "to": "CÁC ĐIỀU NGHIÊM CẤM", "why": "…" }
  ],
  "problems": {
    "2": { "testcases": { "2": { "expected": "12.57 12.57", "why": "…" } } }
  }
}
```

`dropRules` bỏ một khoảng đoạn khỏi phần quy định (từ đoạn bắt đầu bằng `from`, tới
trước đoạn bắt đầu bằng `to`). Cần nó vì phần đầu đề mô tả quy trình nộp bài **thủ
công** — lưu `.cpp`, đặt tên thư mục, nén `.rar`, gửi Zalo — đúng thứ mà hệ thống này
thay thế. Để nguyên thì trang contest dặn member gửi file qua Zalo trong khi họ đang
đứng trước ô nộp bài, kèm câu "sai quy định đặt tên tập tin sẽ không được ghi nhận"
vốn đã sai. Tuần 1 bỏ 16 đoạn, giữ 12 đoạn còn đúng (kỷ luật định dạng đầu ra, cấm dồn
code một dòng, cấm đổi chữ ký hàm, bảng chú thích kiểu dữ liệu).

Script hỏng nếu không tìm thấy `from` hoặc `to` — file fix lạc hậu thì phải biết ngay,
không được im lặng bỏ qua.

## Vì sao có `solutions/`

Nó biến "tôi đã đọc kỹ bộ test" thành "máy chấm xác nhận bộ test". `--validate` xếp
lời giải mẫu qua **đúng** hàm `enqueue` mà nút "kiểm" của mentor vẫn dùng, nên nó ăn
cùng giới hạn 6 lượt/phút và script tự chờ khi chạm trần. Lách giới hạn bằng cách ghi
thẳng vào bảng `submissions` thì bộ test sẽ được "xác nhận" bởi một luồng chẳng ai
dùng thật — nên script không làm thế.

Lời giải nằm ở `solution_source`, `solution_visibility = 'mentor'`, không đi ra qua
API đường member.

## Giới hạn đã biết

- **Chỉ nạp được bài stdio.** Bài dạng function (đề chỉ định chữ ký hàm) cần harness
  cho từng ngôn ngữ; script phát hiện và từ chối thay vì nạp sai thành stdio.
- **Testcase chỉ có đúng những gì đề in ra.** Đề công bố cả bảng ví dụ, nên hai test
  đầu để `sample`, còn lại `hidden` — nhưng bài nào đề chỉ cho 2 ví dụ thì bài đó
  **không có test ẩn nào**. Muốn chấm chặt thì mentor thêm test ẩn ở trang soạn bài.
