# BCN Judge

Hệ thống chấm bài tập lập trình nội bộ của câu lạc bộ: quản lý viên đăng bài theo khoá học,
thành viên code trên trình duyệt, chấm tự động bằng testcase, contest theo tuần có bảng xếp hạng.

- Yêu cầu: [`docs/requirements.md`](docs/requirements.md) (v0.7)
- Thiết kế: [`docs/design.md`](docs/design.md) — 14 ADR, delta Team/Leader, delta P0, delta FR-D10

## Chạy thử trong 3 lệnh

```bash
bash scripts/build-runner-images.sh --all   # 4 runner image (bỏ --all thì chỉ gcc + python)
bash scripts/run-local.sh                   # Postgres + migrate + seed + API + worker + SPA
# → http://localhost:5174    admin@bcn.local / bcnjudge
```

Seed mặc định chỉ có ngôn ngữ, settings và một admin, nên mọi màn hình đều rỗng.
Để xem hệ thống lúc "có người dùng":

```bash
cd server && npm run db:seed:demo -- --reset
```

Tạo 3 mentor · 32 member · 5 nhóm có leader · 2 khoá học kèm giáo trình · 8 bài
tập với testcase mẫu và ẩn · 3 contest (đã kết thúc / đang diễn ra / sắp diễn ra) ·
333 bài nộp đã chấm trải đều AC/WA/TLE/RE/CE, nên tiến độ, bảng xếp hạng khoá và
bảng xếp hạng contest đều có số thật. Mọi tài khoản mẫu: `matkhau123`.

Thêm `--judge` để xếp thêm một ít bài ở trạng thái `pending` cho worker chấm thật —
cách nhanh nhất để kiểm chứng hàng đợi và sandbox còn chạy đúng. Script từ chối
chạy nếu `DATABASE_URL` không trông giống máy dev.

Kiểm chứng toàn hệ thống qua HTTP (cần API + worker đang chạy):

```bash
node scripts/smoke.mjs      # 29 kiểm tra: cấp tài khoản → soạn bài → nộp → chấm → verdict
node scripts/judge-e2e.mjs  # 93 kiểm tra, chỉ soi luồng chấm nhưng soi tới đáy (~60 s)
```

Và bộ E2E lái **trình duyệt thật** qua toàn bộ luồng giao diện:

```bash
npm run e2e         # 31 kiểm tra Playwright, tự dựng cả stack (~2,5 phút)
npm run e2e:ui      # chế độ xem từng bước
```

`npm run e2e` tự lo mọi thứ: database riêng `bcn_judge_e2e_ui`, migrate, seed dữ
liệu mẫu, API, worker, vite. Phủ: đăng nhập/đăng xuất/tài khoản bị khoá/bắt đổi mật
khẩu lần đầu, mọi route theo từng vai trò, gõ code → chạy thử → nộp → verdict qua
Docker thật, contest và bảng xếp hạng, team của leader, soạn bài của mentor, cấp
tài khoản và tình trạng chấm của admin, đổi theme và nhớ qua lần tải lại.

Đây là bộ duy nhất bắt được lớp lỗi ở giữa: route không ai link tới, class Tailwind
không sinh ra CSS, form không submit, panel không đổi khi bấm thanh icon.

`judge-e2e.mjs` cần một database **còn trống** (nó tạo tài khoản, khoá, bài mới và
không dọn sau khi chạy) và bật cả 5 ngôn ngữ. Phủ: AC trên cả năm ngôn ngữ, cả sáu
verdict sinh từ hành vi thật của chương trình, điểm từng phần, hai canary chứng
minh testcase ẩn không rò, chạy thử (mẫu và input tự nhập), giới hạn tần suất, bốn
người nộp đồng thời, contest và bảng xếp hạng, chấm lại hai chiều kèm vết kiểm
toán, bài dạng function, và các cổng chặn quanh luồng nộp.

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

## Bài dạng function (kiểu LeetCode) — FR-D10

Ngoài bài stdio thông thường, mentor đặt bài ở dạng **hàm**: người học chỉ viết một
hàm theo chữ ký cho sẵn, không viết `main`. Mentor soạn một *harness* cho từng ngôn
ngữ; hệ thống ghép harness với mã người học rồi biên dịch thành một chương trình.

Sau khi ghép, chương trình vẫn đọc stdin và ghi stdout như mọi bài stdio — nên
sandbox, hàng đợi, worker, chấm điểm, bảng xếp hạng, chấm lại **không đổi một dòng**.
Quy ước tên file: harness chiếm chỗ điểm vào (`main.c`, `Main.java`…), mã người học
nằm ở `solution.c` / `Solution.java` / `solution.py` / `solution.cpp` / `solution.js`.

Ba điều đáng biết trước khi soạn:

- **Harness không được tự phán đúng/sai.** Nó chạy chung sandbox với code không tin
  được, nên `printf("PASS")` giả mạo được. Harness chỉ in giá trị trả về; verdict do
  máy chủ quyết ở ngoài — cùng lý do `run.sh` in dòng đo bằng root ngoài `setpriv`.
- **Ngôn ngữ chưa có harness thì không nộp được bằng ngôn ngữ đó**, và bị chặn ngay
  lúc nộp chứ không để thành IE lúc chấm.
- **Harness không bao giờ tới member** — cấm ở tầng kiểu trong serializer, và đường
  member cũng không SELECT cột đó ra khỏi DB.

Thông báo lỗi biên dịch chỉ đúng file và đúng dòng **người học** viết
(`solution.c:3`, không phải file đã ghép) — đã đo trên cả 5 ngôn ngữ. Lỗi nằm trong
harness thì **không một dòng mã harness nào** lọt ra ngoài; người học nhận câu "lỗi
thuộc phần khung do người ra đề viết" thay vì bị đổ oan. Chi tiết ở `docs/design.md`,
mục *Delta FR-D10*.

## Cấu hình VPS cho 120 thành viên

Đo bằng `server/src/testing/stress.ts` (năng lực chấm) và `stress-api.ts` (năng lực
đọc). Số liệu đầy đủ ở `docs/design.md`, mục *Đo tải và cấu hình VPS*.

**Khuyến nghị: 8 vCPU · 16 GB · 40 GB SSD · `WORKER_SLOTS=4`.**

| | Tối thiểu | Khuyến nghị | Thoải mái |
|---|---|---|---|
| vCPU | 4 | **8** | 12 |
| RAM | 8 GB | **16 GB** | 16 GB |
| `WORKER_SLOTS` | 2 | **4** | 6 |
| Nộp dồn 100 bài C++ | cạn sau 98 s | **51 s** | 39 s |
| Người chờ lâu nhất | 95 s | **49 s** | 36 s |

Ba con số chi phối:

- **1 slot ≈ 1 nhân** (mỗi container đặt `NanoCpus = 1`). Đặt slot bằng **nửa số
  vCPU** — trên máy 10 nhân, 4 slot còn 88 % hiệu suất, 8 slot rơi xuống 69 %.
- **≈ 190 MB RAM mỗi slot** ở tải nặng thực tế, nhưng trần biên dịch là 1 GB mỗi
  slot. Tính RAM theo trần: `slot × 1 GB + 1,5 GB` cho API, Postgres, Docker và OS.
- **API không phải nút cổ chai**: 100 người bắn hết sức đạt 1 714 req/s, p95 121 ms,
  không lỗi — gấp 17 lần tải thực tế. Nút cổ chai là số nhân CPU dành cho bộ chấm.

**Đừng dùng vCPU burstable có hạn mức tín dụng** (t2/t3 khi cạn credit). TLE tính
theo giờ CPU nên nhiễu thường không gây oan, nhưng vẫn có chốt chặn giờ tường ở
`2T + 2s`: CPU bị bóp xuống 5–20 % sẽ giết oan bài làm đúng. vCPU chia sẻ loại tốt
thì dùng được.

Đĩa: 4 runner image chiếm 1,7 GB; mỗi bài nộp ≈ 30 KB, nên 120 người × 200 bài mỗi
học kỳ ≈ 700 MB/kỳ. 40 GB đủ dùng nhiều năm.

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

## Bảy điều thiết kế nói đúng nhưng Docker làm khác

Cả bảy đều **hỏng im lặng**: không exception, chỉ là mọi bài nộp trả verdict sai. Đây là lý do
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

7. **`run.sh` nuốt sạch stderr của trình biên dịch** vì thứ tự chuyển hướng ngược:
   `2>/dev/null >&2` đặt fd2 vào `/dev/null` **trước**, rồi `>&2` nhân bản fd2 đó vào
   fd1 — cả hai cùng trỏ `/dev/null`. Hệ quả: **mọi bài CE trong toàn hệ thống chỉ
   hiện "Biên dịch thất bại."**, không nói sai ở đâu. Với câu lạc bộ dạy C cho người
   mới, đây là hỏng ở đúng chỗ đau nhất. Test cũ không bắt được vì chỉ kiểm
   `compileOutput.length > 0`, mà chính chuỗi dự phòng cũng thoả điều kiện đó.

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
