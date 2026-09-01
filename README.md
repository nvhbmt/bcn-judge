# BCN Judge

Hệ thống chấm bài tập lập trình nội bộ của câu lạc bộ: quản lý viên đăng bài theo khoá học,
thành viên code trên trình duyệt, chấm tự động bằng testcase, contest theo tuần có bảng xếp hạng.

- Yêu cầu: [`docs/requirements.md`](docs/requirements.md) (v0.7)
- Thiết kế: [`docs/design.md`](docs/design.md) — 14 ADR, delta Team/Leader, delta P0

## Chạy thử trong 3 lệnh

```bash
bash scripts/build-runner-images.sh --all   # 4 runner image (bỏ --all thì chỉ gcc + python)
bash scripts/run-local.sh                   # Postgres + migrate + seed + API + worker + SPA
# → http://localhost:5174    admin@bcn.local / bcnjudge
```

Kiểm chứng toàn hệ thống qua HTTP (cần API + worker đang chạy):

```bash
node scripts/smoke.mjs      # 29 kiểm tra: cấp tài khoản → soạn bài → nộp → chấm → verdict
```

## Trạng thái

| Phase | Nội dung | Trạng thái |
|---|---|---|
| **P0** | Nguyên mẫu sandbox + bộ abuse | ✅ 23 ca xanh trên Docker thật |
| **P1** | Schema, auth, khoá học, ma trận quyền | ✅ |
| **P2** | Hàng đợi, worker, API nộp bài, chống rò dữ liệu ẩn | ✅ |
| **P3** | Workspace: thanh icon, split, CodeMirror, verdict trực tiếp | ✅ |
| **P4** | Nội dung khoá, tiến độ, BXH khoá, team & leader | ✅ API + UI |
| **P5** | Contest tuần, bảng xếp hạng, đóng băng, luyện tập | ✅ API + UI |
| **P6** | API quản trị, compose, deploy, sao lưu | ✅ · **chưa deploy lên VPS thật** |
| **P7** | Kiểm chứng end-to-end | ✅ smoke 29/29 |

**253 test xanh**: 164 server (gồm 23 ca abuse trên Docker và 3 ca chấm thật qua hàng đợi) +
89 SPA. Cộng 29 kiểm tra smoke qua HTTP với worker và container thật.

Mọi yêu cầu mức **M** và mức **S** của `requirements.md` đã hiện thực hoá, gồm cả những mục
lắt léo nhất: chấm lại có shadow attempt và audit (FR-D9), contest mở tuần tự (FR-I8), đóng
băng bảng xếp hạng (FR-I10), team/leader với hai bất biến ép ở tầng DB (FR-J), ghi chú của
leader (FR-J6), bốn ngôn ngữ chấm.

Chưa làm, đều là mức **C**: đăng nhập Google (FR-A5), checker tự viết (FR-D5), phát hiện
trùng code (FR-G7), lịch tự tạo contest hằng tuần (FR-I11).

**Nợ kỹ thuật quan trọng nhất** (ghi trong `docs/design.md` §14): mọi số đo và toàn bộ bộ abuse
mới chạy trên **máy dev (OrbStack)**. §11 của thiết kế yêu cầu chạy lại trên **đúng kernel/Docker
của VPS đích** trước khi mở cho member — ba mục cần đo lại là `docker update --memory` shrink,
`memory.events` trong namespace, và half-close của exec stdin. `deploy/provision-vps.sh` in ra
nhắc nhở này ở bước cuối.

## Bộ abuse chứng minh được gì

Chạy trên Docker thật, không mock. Mỗi ca ánh xạ thẳng tới một yêu cầu.

| Nhóm | Ca | Yêu cầu |
|---|---|---|
| Ca số 0 | C, C++, Python, Java, Node biên dịch + chạy end-to-end | §3.2 phase 1 |
| Nhập/xuất | stdin nhận EOF thật, WA báo đúng dòng lệch | FR-F1, FR-D5 |
| Chấm điểm | điểm chuẩn hoá 0–100 (66.67 khi 2/3 test đúng) | FR-F2 v0.5 |
| Verdict | CE, TLE, MLE, RE(SIGSEGV) trên hành vi thật | §3.4 |
| Chống phá hoại | fork bomb → **testcase sau vẫn chấm**; tràn output → RE; ghi 200 MB bị chặn | US-9 |
| Cách ly | không mạng; không đọc được `/etc/shadow`, `run.sh`, file đo; `/w` chỉ có source | US-6, NFR-1 |
| Chống giả mạo | in dòng `__JUDGE_META__` giả vẫn nhận TLE | §3.2 |
| Siết an ninh | hạ được bounding set capability trên **cả hai** image | §3.2 |
| Vệ sinh | không sót container mồ côi | §3.2 phase 5 |

Độ trễ trên máy dev, hàng đợi rỗng: **C 620 ms · C++ 627 ms · Python 487 ms · Java 883 ms ·
Node 433 ms** (ngưỡng NFR-4 là ≤ 3 s; C++ kể cả biên dịch ≤ 10 s).

## Sáu điều thiết kế nói đúng nhưng Docker làm khác

Cả sáu đều **hỏng im lặng**: không exception, chỉ là mọi bài nộp trả verdict sai. Đây là lý do
P0 phải chạy trước mọi thứ khác.

1. **`putArchive` không dùng được với `--read-only`** → nạp source qua stdin của exec.
2. **Root trong container không ghi nổi `/w`** (đã drop `CAP_DAC_OVERRIDE`) → `/w` mount `gid=0,mode=0775`.
3. **Docker mặc định mount mọi tmpfs là `noexec`** → thiếu chữ `exec`, **mọi bài C/C++ nhận RE(126)**.
4. **`prlimit` không nâng được hard limit** → trần `fsize` lúc biên dịch nhỏ hơn binary tĩnh.
5. **`setpriv --bounding-set` phụ thuộc phiên bản util-linux** — 2.41 (image python) đòi
   `CAP_SETPCAP` và exit 127 ⇒ **mọi bài Python thành CE**. Nay `run.sh` thăm dò trước và
   **báo `bset` ra dòng meta** để lớp siết an ninh hỏng thì nhìn thấy được.
6. **PATH của sandbox không phủ mọi image** — python ở `/usr/local/bin`, JDK ở
   `/opt/java/openjdk/bin`. Lần thứ ba của cùng lớp lỗi nên chốt quy ước: **runner image tự
   đưa toolchain lên PATH chuẩn**, không nới PATH của sandbox theo từng ngôn ngữ.

## Mười ba lỗi API do việc dựng giao diện làm lộ ra

Test cũ không bắt được vì chúng gọi đúng những gì server chờ đợi. Đáng chú ý nhất:

- **`sampleCount` của route zip không kiểm** — gửi số lớn là biến **toàn bộ testcase ẩn thành
  testcase mẫu**, tức lộ sạch bộ test cho member (NFR-2).
- **PATCH bài tập nhận rồi vứt 5 trường** (`tags`, `examples`, `starterCode`, `floatEps`,
  `scopeCourseId`): zod cho qua, audit ghi như đã đổi, UPDATE không có cột.
- **Tiêu chí US-2 "báo rõ testcase 7 kèm diff" không đạt được**: kết quả validate chỉ đọc được
  qua đường member, mà serializer member tước diff của testcase ẩn.

Chi tiết đầy đủ nằm trong commit `P4/P5 UI`.

## Bố cục

```
src/                     SPA: components/{layout,editor,markdown,ui}, pages/{,mentor,admin,workspace}
tests/                   test SPA (vitest + jsdom)
server/
  src/
    auth/                session token mờ (không JWT), argon2id, guard 3 vai trò
    db/                  schema Drizzle, migrate, seed, 3 role Postgres
    judge/               languages · sandbox · runner · queue (+ chấm lại) · verdict · compare
    serialize/           cổng chặn dữ liệu ẩn (NFR-2) — trường cấm khai kiểu never
    routes/{admin,mentor,member}/   cây route tách theo vai trò
    contest/standings.ts truy vấn xếp hạng dẫn xuất
    realtime/            LISTEN/NOTIFY + SSE có replay
    worker.ts            judge worker
  runner/                Dockerfile 4 ngôn ngữ + run.sh + fixture abuse
  drizzle/               SQL migration viết tay (FK deferrable, partial index, trigger)
  deploy/                deploy · provision · backup · cổng migration
scripts/                 build image · run-local · smoke · ràng buộc nguồn
docs/                    requirements.md · design.md
```

## Lệnh hay dùng

```bash
# SPA
npm run dev · build · test · lint · typecheck · smoke

# Server
cd server
npm run dev                  # API :8099
node --import tsx src/worker.ts
npm test                     # đơn vị
npm run test:sandbox         # bộ abuse (cần Docker)
npm run test:integration     # cần Postgres, tên DB phải chứa "test"
npm run db:migrate · db:seed · db:grants
```
