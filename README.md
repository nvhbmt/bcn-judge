# BCN Judge

Hệ thống chấm bài tập lập trình nội bộ của câu lạc bộ: quản lý viên đăng bài theo khoá học,
thành viên code trên trình duyệt, chấm tự động bằng testcase, contest theo tuần có bảng xếp hạng.

- Yêu cầu: [`docs/requirements.md`](docs/requirements.md) (v0.7)
- Thiết kế: [`docs/design.md`](docs/design.md) (13 ADR + delta Team/Leader + delta P0)

## Trạng thái

| Phase | Nội dung | Trạng thái |
|---|---|---|
| **P0** | Nguyên mẫu sandbox + bộ abuse test | ✅ **xanh** — 20/20 ca trên Docker thật |
| P1 | Khung repo, schema, auth, khoá học | chưa bắt đầu |
| P2 | Queue + worker + API chấm bài | chưa bắt đầu |
| P3 | Workspace UI (icon rail, split pane, CodeMirror) | chưa bắt đầu |
| P4–P7 | Nội dung khoá, team/leader, contest, vận hành | chưa bắt đầu |

P0 là **cổng go/no-go** của cả dự án (design.md §11): phần chạy code không tin cậy là thứ
duy nhất chưa có tiền lệ trong workspace. Cổng này đã mở.

## Chạy thử

```bash
# 1. Build hai runner image (gcc 455 MB, python 204 MB)
bash scripts/build-runner-images.sh

# 2. Chấm thử một bài bằng tay — không cần DB, không cần API
cd server && npm install
npm run judge:demo                      # "Tổng hai số", C11, 4 testcase
npm run judge:demo -- --lang python3
npm run judge:demo -- --lang c11 --source ../runner/abuse/infinite_loop.c

# 3. Bộ test
npm test                                # đơn vị (compare + bảng verdict), không cần Docker
npm run test:sandbox                    # bộ abuse trên Docker thật
```

## Bộ abuse chứng minh được gì

Mỗi ca ánh xạ thẳng tới một yêu cầu; chạy trên Docker thật, không mock.

| Nhóm | Ca | Yêu cầu |
|---|---|---|
| Ca số 0 | C, C++, Python biên dịch + chạy end-to-end | §3.2 phase 1 |
| Nhập/xuất | stdin nhận EOF thật (half-close), tổng hai số, WA báo đúng dòng lệch | FR-F1, FR-D5 |
| Chấm điểm | điểm chuẩn hoá 0–100 theo trọng số (66.67 khi 2/3 test đúng) | FR-F2 v0.5 |
| Verdict | CE, TLE, MLE, RE(SIGSEGV) trên hành vi thật | §3.4 |
| Chống phá hoại | fork bomb → **testcase sau vẫn chấm được**; tràn output → RE(output_limit); ghi 200 MB bị chặn | US-9, NFR-1 |
| Cách ly | không mạng (connect + DNS đều fail); không đọc được `/etc/shadow`, `run.sh`, file đo; rootfs read-only; `/w` chỉ có source — **không có thư mục testcase nào để đọc** | US-6, NFR-1, NFR-2 |
| Chống giả mạo | chương trình in dòng `__JUDGE_META__` giả vẫn nhận TLE | §3.2 |
| Siết an ninh | bounding set của capability hạ được trên **cả hai** image | §3.2 |
| Vệ sinh | không sót container mồ côi sau toàn bộ suite | §3.2 phase 5 |

Đo trên máy dev (OrbStack, cgroup v2), hàng đợi rỗng, bài 4 testcase:
**C 620 ms · C++ 627 ms · Python 487 ms** — ngưỡng NFR-4 là ≤ 3 s (C++ kể cả biên dịch ≤ 10 s).

## Năm điều thiết kế nói đúng nhưng thực tế khác — P0 bắt được

Đây chính là lý do P0 phải chạy trước mọi thứ khác. Cả năm đều **im lặng**: không lỗi, không
cảnh báo, chỉ là mọi bài nộp trả verdict sai.

1. **`putArchive` không dùng được với `--read-only`.** Docker daemon từ chối nạp tar vào bất kỳ
   container nào có `ReadonlyRootfs`, kể cả khi đích là tmpfs ghi được. → Source đi vào bằng
   **stdin của một exec**, đúng nguyên tắc thiết kế đã chọn cho testcase; giữ nguyên rootfs read-only.
2. **Root trong container không ghi nổi `/w`.** Đã `--cap-drop ALL` nên root không có
   `CAP_DAC_OVERRIDE`; `/w` do uid 1000 sở hữu mode 0755 chặn cả root. → mount `/w` với
   `gid=0,mode=0775` (rẻ và hẹp hơn nhiều so với cấp thêm capability).
3. **Docker mặc định mount mọi `--tmpfs` là `noexec`.** Danh sách cờ trong thiết kế không ghi
   `exec`, nên binary biên dịch xong nằm ở `/w` không chạy được → **mọi bài C/C++ nhận RE(126)**.
   → `/w` ghi rõ `exec`; `/tmp` giữ `noexec` như thiết kế.
4. **`prlimit` không nâng được hard limit.** `run.sh` suy `fsize` từ trần output (64 KB lúc biên
   dịch → ~1 MB), nhỏ hơn binary tĩnh; mà tiến trình không đặc quyền cũng không nâng lên được.
   → hard limit ở mức container nới đủ cho biên dịch, `run.sh` chỉ **hạ** trần chặt cho lượt chạy.
5. **`setpriv --bounding-set=-all` phụ thuộc phiên bản util-linux.** 2.38 (bookworm — image gcc)
   bỏ qua êm; 2.41 (trixie — image python) đòi `CAP_SETPCAP`, không có thì exit 127 ⇒ **mọi bài
   Python thành CE**. → cấp `CAP_SETPCAP` (không nới quyền cho member), `run.sh` thăm dò trước
   và **báo `bset` ra dòng meta** để lớp siết an ninh hỏng thì nhìn thấy được; bộ test khoá lại
   trên cả hai image. Cùng lớp lỗi: thiết kế đặt `PATH=/usr/bin:/bin` trong khi image python để
   interpreter ở `/usr/local/bin`.

Chi tiết và lý do chọn phương án nằm trong `docs/design.md` §14 (Delta P0) và trong comment
tại chính chỗ code lệch khỏi thiết kế.

## Bố cục

```
server/
  src/judge/         languages · sandbox · runner · verdict · compare  (+ test)
  runner/images/     gcc/ python/ Dockerfile + common/run.sh
  runner/abuse/      fixture cho bộ abuse
scripts/             build-runner-images.sh
docs/                requirements.md · design.md
```
