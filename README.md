# BCN Judge

Hệ thống chấm bài tập lập trình nội bộ của câu lạc bộ: quản lý viên đăng bài theo khoá học,
thành viên code trên trình duyệt, chấm tự động bằng testcase, contest theo tuần có bảng xếp hạng.

- Yêu cầu: [`docs/requirements.md`](docs/requirements.md) (v0.7)
- Thiết kế: [`docs/design.md`](docs/design.md) — 14 ADR, delta Team/Leader, delta P0

## Chạy thử trong 3 lệnh

```bash
bash scripts/build-runner-images.sh   # hai runner image: gcc 455 MB, python 204 MB
bash scripts/run-local.sh             # Postgres + migrate + seed + API + worker + SPA
# → http://localhost:5174   admin@bcn.local / bcnjudge
```

Kiểm chứng toàn hệ thống qua HTTP (cần API + worker đang chạy):

```bash
node scripts/smoke.mjs        # 29 kiểm tra: cấp tài khoản → soạn bài → nộp → chấm → verdict
```

## Trạng thái từng phase

| Phase | Nội dung | Trạng thái |
|---|---|---|
| **P0** | Nguyên mẫu sandbox + bộ abuse | ✅ 20 ca xanh trên Docker thật |
| **P1** | Schema, auth, khoá học, ma trận quyền | ✅ API + test đầy đủ |
| **P2** | Hàng đợi, worker, API nộp bài, chống rò dữ liệu ẩn | ✅ chấm end-to-end thật |
| **P3** | Workspace: thanh icon, split, CodeMirror, verdict trực tiếp | ✅ |
| **P4** | Nội dung khoá, tiến độ, BXH khoá, team & leader | ✅ API đủ · UI member đủ · **UI soạn bài của mentor chưa có** |
| **P5** | Contest tuần, bảng xếp hạng, đóng băng, luyện tập | ✅ API đủ · UI member đủ · **UI tạo contest chưa có** |
| **P6** | API quản trị, compose, deploy, sao lưu | ✅ · **chưa deploy lên VPS thật** |
| **P7** | Kiểm chứng end-to-end | ✅ smoke 29/29 |

**231 test xanh**: 148 server (gồm 20 ca abuse trên Docker và 3 ca chấm thật qua hàng đợi) +
83 SPA. Cộng 29 kiểm tra smoke qua HTTP.

## Còn thiếu — nói thẳng

Những thứ này **có API đầy đủ và có test**, nhưng **chưa có màn hình**; hiện phải gọi API trực tiếp:

- Mentor soạn bài tập, tải zip testcase, bấm "kiểm tra bằng lời giải mẫu", soạn chương/mục
- Mentor tạo contest, chọn bài, xuất bản, xem thống kê
- Admin quản lý tài khoản, khoá học, team (mới có trang tình trạng chấm)

Chưa làm, đều là mức **S** hoặc **C** trong requirements:

- Image Java 17 / Node 20 (đã có dòng cấu hình, chưa build image)
- FR-I8 mở bài tuần tự · FR-J5 lọc BXH theo team · FR-J6 ghi chú của leader
- FR-D5 so sánh số thực · checker tự viết · FR-G7 phát hiện trùng code

**Nợ kỹ thuật quan trọng nhất** (đã ghi trong `docs/design.md` §14): mọi số đo và toàn bộ bộ
abuse mới chạy trên **máy dev (OrbStack)**. §11 của thiết kế yêu cầu chạy lại trên **đúng
kernel/Docker của VPS đích** trước khi mở cho member — ba mục cần đo lại là `docker update
--memory` shrink, `memory.events` trong namespace, và half-close của exec stdin.
`server/deploy/provision-vps.sh` in ra nhắc nhở này ở bước cuối.

## Bộ abuse chứng minh được gì

Chạy trên Docker thật, không mock. Mỗi ca ánh xạ thẳng tới một yêu cầu.

| Nhóm | Ca | Yêu cầu |
|---|---|---|
| Ca số 0 | C, C++, Python biên dịch + chạy end-to-end | §3.2 phase 1 |
| Nhập/xuất | stdin nhận EOF thật, WA báo đúng dòng lệch | FR-F1, FR-D5 |
| Chấm điểm | điểm chuẩn hoá 0–100 (66.67 khi 2/3 test đúng) | FR-F2 v0.5 |
| Verdict | CE, TLE, MLE, RE(SIGSEGV) trên hành vi thật | §3.4 |
| Chống phá hoại | fork bomb → **testcase sau vẫn chấm**; tràn output → RE; ghi 200 MB bị chặn | US-9 |
| Cách ly | không mạng; không đọc được `/etc/shadow`, `run.sh`, file đo; `/w` chỉ có source | US-6, NFR-1 |
| Chống giả mạo | in dòng `__JUDGE_META__` giả vẫn nhận TLE | §3.2 |
| Siết an ninh | hạ được bounding set capability trên **cả hai** image | §3.2 |
| Vệ sinh | không sót container mồ côi | §3.2 phase 5 |

Độ trễ trên máy dev, hàng đợi rỗng, bài 4 testcase: **C 620 ms · C++ 627 ms · Python 487 ms**
(ngưỡng NFR-4 là ≤ 3 s; C++ kể cả biên dịch ≤ 10 s).

## Năm điều thiết kế nói đúng nhưng Docker làm khác — P0 bắt được

Cả năm đều **hỏng im lặng**: không exception, chỉ là mọi bài nộp trả verdict sai.

1. **`putArchive` không dùng được với `--read-only`** → nạp source qua stdin của exec.
2. **Root trong container không ghi nổi `/w`** (đã drop `CAP_DAC_OVERRIDE`) → `/w` mount `gid=0,mode=0775`.
3. **Docker mặc định mount mọi tmpfs là `noexec`** → thiếu chữ `exec`, **mọi bài C/C++ nhận RE(126)**.
4. **`prlimit` không nâng được hard limit** → trần `fsize` lúc biên dịch nhỏ hơn binary tĩnh.
5. **`setpriv --bounding-set` phụ thuộc phiên bản util-linux** — 2.38 bỏ qua êm, 2.41 (image
   python) đòi `CAP_SETPCAP` và exit 127 ⇒ **mọi bài Python thành CE**. Đã cấp cap, cho run.sh
   thăm dò trước, và **báo `bset` ra dòng meta** để lần sau lớp siết an ninh hỏng thì nhìn thấy được.

Chi tiết và lý do chọn phương án: `docs/design.md` §14 (Delta P0) và comment tại chính chỗ code lệch.

## Bố cục

```
src/                     SPA: components/{layout,editor,markdown,ui}, pages/, hooks/, lib/
tests/                   test SPA (vitest + jsdom)
server/
  src/
    auth/                session token mờ (không JWT), argon2id, guard 3 vai trò
    db/                  schema Drizzle, migrate, seed, 3 role Postgres
    judge/               languages · sandbox · runner · queue · verdict · compare
    serialize/           cổng chặn dữ liệu ẩn (NFR-2) — trường cấm khai kiểu never
    routes/{admin,mentor,member}/   cây route tách theo vai trò
    contest/standings.ts truy vấn xếp hạng dẫn xuất
    realtime/            LISTEN/NOTIFY + SSE có replay
    worker.ts            judge worker
  runner/                Dockerfile theo ngôn ngữ + run.sh + fixture abuse
  drizzle/               SQL migration (viết tay: FK deferrable, partial index, trigger)
  deploy/                deploy · provision · backup · cổng migration
scripts/                 build image · run-local · smoke · ràng buộc nguồn
docs/                    requirements.md · design.md
```

## Lệnh hay dùng

```bash
# SPA
npm run dev · build · test · lint · typecheck

# Server
cd server
npm run dev                  # API :8099
node --import tsx src/worker.ts
npm test                     # đơn vị
npm run test:sandbox         # bộ abuse (cần Docker)
npm run test:integration     # cần Postgres, tên DB phải chứa "test"
npm run db:migrate · db:seed · db:grants
```
