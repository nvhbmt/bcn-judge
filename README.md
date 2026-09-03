# BCN Judge

Hệ thống chấm bài tập lập trình nội bộ của câu lạc bộ: quản lý viên đăng bài theo khoá học,
thành viên code trên trình duyệt, chấm tự động bằng testcase, contest theo tuần có bảng xếp hạng.

- Yêu cầu: [`docs/requirements.md`](docs/requirements.md) (v0.7)
- Thiết kế: [`docs/design.md`](docs/design.md) — 14 ADR, delta Team/Leader, delta P0, delta FR-D10
- **Deploy: [`docs/deploy.md`](docs/deploy.md)** — từ VPS trắng tới lúc member đăng nhập được

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

### Cấu hình dev bằng `server/.env`

`run-local.sh` tự truyền `DATABASE_URL` nên không cần file gì. Nhưng khi chạy tay
từng lệnh trong `server/`, hoặc khi cần bật thêm biến (ví dụ `DISCORD_*`), thì tạo
`server/.env` — các script đã kèm cờ `--env-file-if-exists=.env` của Node, không
dùng gói `dotenv`. Chép mẫu từ `server/.env.example` (bản đó dành cho production,
secret tách thành ba file theo ADR-5).

**Biến đặt ở shell THẮNG file `.env`** (hành vi của `--env-file`, đã đo). Nhờ vậy
`run-local.sh` và `npm run test:integration` — hai chỗ tự trỏ `DATABASE_URL` riêng —
không bị một `.env` lạc trên máy kéo sang DB khác. `.env` chỉ lấp chỗ trống.

Hai chỗ cố ý KHÔNG kèm cờ đó: `test` và `test:integration`. Đường chạy test không
nên phụ thuộc vào một file không có trong git.

## Nạp contest từ đề .docx

Đề "Code C hằng tuần" soạn tay trong Word. `contests/README.md` mô tả đủ; ngắn gọn:

```bash
cd server
npm run db:import:contest -- "../<đề>.docx" --data ../contests/code-c-tuan-01 --validate
```

Script đọc .docx nguyên văn, áp `fix.json` (đính chính có ghi lý do, in ra mỗi lần
nạp), tạo khoá + contest + bài + testcase, rồi `--validate` xếp lời giải mẫu qua đúng
hàng đợi của sản phẩm để **máy chấm tự xác nhận bộ test** thay vì tin lời người nạp.
File .docx của người ra đề không bị sửa.

Kiểm chứng toàn hệ thống qua HTTP (cần API + worker đang chạy):

```bash
node scripts/smoke.mjs      # 29 kiểm tra: cấp tài khoản → soạn bài → nộp → chấm → verdict
node scripts/judge-e2e.mjs  # 93 kiểm tra, chỉ soi luồng chấm nhưng soi tới đáy (~60 s)
```

Và bộ E2E lái **trình duyệt thật** qua toàn bộ luồng giao diện:

```bash
npm run e2e         # 39 kiểm tra Playwright, tự dựng cả stack (~2,5 phút)
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

## Đăng nhập bằng Discord

Tuỳ chọn. Thiếu cấu hình thì tính năng tắt hẳn và nút Discord **không hiện** ở màn
đăng nhập — không phải hiện rồi bấm vào mới lỗi.

Bật trong bốn bước:

1. https://discord.com/developers/applications → **New Application**.
2. Tab **OAuth2** → **Redirects** → thêm đúng URL callback, ví dụ
   `https://judge.example.vn/auth/discord/callback` (dev: `http://localhost:8099/auth/discord/callback`).
   Discord so khớp **nguyên văn**, lệch một dấu `/` là `invalid_redirect_uri`.
3. Copy **Client ID** và **Client Secret**.
4. Đặt ba biến vào `.env.api` rồi khởi động lại API:

```bash
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=https://judge.example.vn/auth/discord/callback
```

**Discord KHÔNG cấp tài khoản mới.** Nó chỉ là cách xác thực một tài khoản admin đã
cấp — đúng như màn đăng nhập vẫn nói ("Liên hệ ngay các mentor để được cấp tài
khoản"). Callback không bao giờ `INSERT` vào `users`; test tích hợp đếm số tài khoản
trước và sau mỗi nhánh từ chối để canh đúng điều đó. Nếu tự tạo user thì bất kỳ ai
có Discord đều vào được judge, và vai trò / ghi danh / team do admin cấp mất nghĩa.

Một tài khoản gắn được Discord theo hai đường:

- **Gắn chủ động** — đăng nhập bằng mật khẩu, vào `/tai-khoan`, bấm *Gắn Discord*.
  Đây là đường luôn chạy được, kể cả khi email tài khoản không gửi thư tới được
  (seed dùng `@bcn.local` — không ai đăng ký Discord bằng email đó).
- **Khớp email ở lần đăng nhập đầu** — chỉ khi Discord xác nhận email **đã xác
  minh**. Mức tin cậy đúng bằng "đặt lại mật khẩu qua email". Email chưa xác minh
  bị bỏ qua hẳn, vì lúc đó chuỗi email chỉ là chữ người ta tự gõ vào hồ sơ.

Bỏ gắn ở `/tai-khoan`. Tài khoản **chưa có mật khẩu** thì bị chặn bỏ gắn — bỏ xong
là không còn đường nào vào tài khoản của chính mình.

### Cho cả server Discord vào thẳng (tuỳ chọn)

Khai `DISCORD_GUILD_ID` là **đổi chính sách truy cập**, không phải bật một tiện ích:

> Ai ở trong server Discord đó, đăng nhập bằng Discord sẽ được **tạo tài khoản
> `member` ngay**, không cần mentor cấp. Danh sách thành viên CLB chuyển từ "admin
> duyệt từng người" sang "ai vào được server Discord". **Link mời Discord công khai
> ⇒ judge công khai.**

Thêm `DISCORD_ROLE_ID` để siết một nấc: phải mang đúng role đó trong server mới vào
được — dùng khi server Discord mở cho cả người ngoài CLB.

Tài khoản do cổng này sinh ra luôn là `member`, **không được ghi danh khoá nào**
(trang chủ rỗng cho tới khi mentor xếp lớp), và không có mật khẩu. Không có đường
nào để một cú đăng nhập Discord sinh ra mentor hay admin.

Cổng áp cho ai:

| Tài khoản | Rời server Discord thì sao |
|---|---|
| Do cổng sinh ra (không mật khẩu) | Mất quyền vào — đúng ý "server là danh sách thành viên" |
| Admin cấp tay (có mật khẩu) | Không ảnh hưởng — admin đã bảo lãnh khi tạo |

Hỏi Discord không được (mạng hỏng, token sai) thì **chặn**, và báo bằng một mã
riêng chứ không gộp vào "ngoài server": gộp thành cho-qua là một sự cố mạng mở toang
cổng, gộp thành ngoài-server là báo oan người đang ở trong server.

### Ảnh đại diện

Gắn Discord xong thì ảnh Discord thay chữ cái đầu tên ở thanh trên. Lưu **hash**
Discord trả về, không lưu URL và không tải ảnh về máy chủ: URL do CDN của Discord
quy định, còn tải về là tự nhận việc lưu trữ cho một thứ người ta đổi liên tục. Hash
được làm mới ở mỗi lần đăng nhập bằng Discord.

Không có ảnh riêng (Discord trả `avatar: null`), hoặc ảnh 404 vì hash đã cũ, thì lùi
về chữ cái đầu tên — không để lại khung ảnh vỡ.

Điều dễ quên khi deploy: **CSP ở `server/Caddyfile` phải cho `cdn.discordapp.com`
trong `img-src`.** Dev không có CSP nên ảnh hiện bình thường, còn production chặn
CÂM — không lỗi mạng, không dòng log nào ngoài console của người dùng.

Scope xin là `guilds.members.read`, không phải `guilds`: `guilds` trả về danh sách
**mọi** server người đó tham gia — dữ liệu riêng tư không liên quan gì tới việc họ
có ở CLB hay không.

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

**415 test xanh**: 87 server (đơn vị) + 157 server (integration, cần Postgres — gồm 23 ca
abuse trên Docker và các ca chấm thật qua hàng đợi) + 171 SPA. Cộng 39 kiểm tra
Playwright lái trình duyệt thật, và 29 kiểm tra smoke qua HTTP với worker và container
thật.

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
- **Harness không đi ra qua API** — cấm ở tầng kiểu trong serializer, và đường member
  cũng không SELECT cột đó ra khỏi DB.

Thông báo lỗi biên dịch chỉ đúng file và đúng dòng **người học** viết
(`solution.c:3`, không phải file đã ghép) — đã đo trên cả 5 ngôn ngữ. Lỗi nằm trong
harness thì mã harness không lọt ra qua log biên dịch; người học sai tên hàm thì nhận
câu chỉ đúng tên hàm còn thiếu, chứ không bị đổ oan mà cũng không đổ oan ngược lại cho
mentor. Chi tiết ở `docs/design.md`, mục *Delta FR-D10*.

### Harness bí mật tới đâu — phạm vi thật

Nói cho đúng, vì bản trước README hứa rộng hơn thứ hệ thống làm được:

- **Ngôn ngữ biên dịch (C/C++/Java): kín.** File nguồn của mentor bị xoá khỏi `/w`
  ngay sau khi biên dịch xong, trước khi một dòng mã nào của người học chạy — nên
  `fopen("/w/main.c")` không đọc được gì. Có test chạy thật canh điều này.
- **Ngôn ngữ thông dịch (Python/Node): KHÔNG kín.** Harness chính là điểm vào nên buộc
  phải ở lại trong container, và mã người học chạy trong cùng interpreter thì đọc được
  nó bằng `open()`, `inspect.getsource`, hay chỉ một traceback. Đây là giới hạn của
  kiến trúc một-container-chung, không vá được ở tầng ứng dụng.
- **Bộ lọc log biên dịch chống TAI NẠN, không chống CỐ Ý.** Nó lọc theo file được quy
  trách, không theo nội dung — nên `#pragma message` với macro của mentor vẫn moi được
  thân macro trong một chẩn đoán mang tên file của chính người học. Chặn hẳn lớp này
  phải tách translation unit (biên dịch harness riêng rồi link object).

Nói ngắn: coi harness là **khó lấy**, không phải **không thể lấy** — đừng đặt đáp án
vào harness cho bài Python/Node.

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

### Đường đi của một lượt nộp, đo đầu-tới-cuối

Ba khoản dưới đây từng cộng lại thành **~6,7 giây** kể từ lúc bấm, dù bản thân việc
chấm chỉ mất nửa giây. Cả ba đều hỏng im lặng — không lỗi, không log, chỉ là chậm:

| | trước | sau |
|---|---|---|
| chờ được worker nhặt | ~495 ms | ~15 ms |
| chấm (C, 4 testcase) | ~648 ms | ~504 ms |
| chờ giao diện biết verdict | ~6 000 ms | ~90 ms |
| **bấm → verdict hiện** | **~6 700 ms** | **~640 ms** |

- **Hàng đợi**: worker rảnh thì ngủ hết một nhịp poll 1 giây. Nay xếp việc xong là rung
  chuông qua LISTEN/NOTIFY; nhịp poll giữ nguyên làm lưới an toàn, vì mất chuông chỉ
  chậm lại như cũ còn bỏ poll là hàng đợi đứng im vĩnh viễn.
- **Chấm**: `docker create` + `start` tốn ~155 ms mà chẳng có mili giây nào là code
  người học. Nay container dựng sẵn thành pool ấm — vẫn một container mới mỗi lượt, vẫn
  huỷ sau khi xong, chỉ là tạo sớm hơn.
- **Giao diện**: máy chủ gửi sự kiện SSE **có tên**, client lại chỉ gắn
  `EventSource.onmessage` — thứ chỉ nổ với sự kiện không tên. Nên FR-F4 chưa từng chạy
  trên trình duyệt, và verdict về bằng đường lùi polling: 4 giây chờ ân hạn cộng một
  nhịp 2 giây. Không test nào đỏ vì kết quả vẫn đúng, chỉ chậm mười lần.

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

## Deploy

Toàn hệ thống chạy trên **một VPS** bằng `docker compose`: Caddy → api-blue/api-green
(blue/green) · worker → docker-proxy → socket Docker · Postgres là service có trạng
thái duy nhất. Runbook đầy đủ ở **[`docs/deploy.md`](docs/deploy.md)**.

Lần đầu:

```bash
sudo bash server/deploy/provision-vps.sh     # Docker, sysctl siết userns, chrony
cd server && cp .env.example .env            # rồi tạo .env.api/.env.worker/.env.migrate
bash ../scripts/build-runner-images.sh --all
docker compose run --rm migrate
docker compose run --rm --entrypoint node migrate --import tsx src/db/grants.ts
SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... \
  docker compose run --rm --entrypoint node migrate --import tsx src/db/seed.ts
docker compose up -d
```

Cập nhật:

```bash
bash deploy/deploy.sh              # API lật blue/green + worker + giao diện
bash deploy/deploy.sh --spa-only   # chỉ giao diện, không đụng judge/DB
```

Bốn điều dễ vấp nhất, cả bốn đều **hỏng im lặng**:

- **Quên `db:seed`** → không có ngôn ngữ chấm, không có admin. Hệ thống lên nhưng không
  ai vào được.
- **Quên `db:grants`** → bảng mới không có grant; migrate im re, chỉ nổ lúc có người
  dùng thật chạm vào.
- **`BCN_DOMAIN` / `BCN_API_UPSTREAM` phải nằm trong `environment:` của service caddy**,
  không phải chỉ là biến shell — Caddyfile đọc chúng từ env của chính tiến trình Caddy.
  Thiếu thì lật blue/green xong Caddy vẫn trỏ vào container vừa tắt.
- **`VITE_API_BASE_URL` phải RỖNG** trong bản build production (Dockerfile đã ghim), nếu
  không bundle sẽ gọi thẳng một host cụ thể và bỏ qua reverse proxy.

**Chưa deploy lên VPS thật.** Nợ P0 bắt buộc trả trước khi mở cho member: chạy lại bộ
abuse trên đúng kernel/Docker của máy đích (`docs/deploy.md` §9).

## Bố cục

```
src/                     SPA: components/{layout,editor,markdown,ui}, pages/{,mentor,admin,workspace}
tests/                   test SPA (vitest + jsdom)
server/
  src/
    auth/                session token mờ (không JWT), argon2id, guard 3 vai trò
    db/                  schema Drizzle, migrate, seed, 3 role Postgres
    judge/               languages · sandbox · runner · queue (+ chấm lại) · verdict · compare
                         pool (container ấm) · wake (đánh thức worker) · reap (dọn mồ côi)
    serialize/           cổng chặn dữ liệu ẩn (NFR-2) — trường cấm khai kiểu never
    routes/{admin,mentor,member}/   cây route tách theo vai trò
    contest/standings.ts truy vấn xếp hạng dẫn xuất
    realtime/            LISTEN/NOTIFY + SSE có replay
    worker.ts            judge worker
  runner/                Dockerfile 4 ngôn ngữ + run.sh + fixture abuse
  drizzle/               SQL migration viết tay (FK deferrable, partial index, trigger)
  deploy/                deploy · provision · backup · cổng migration · Caddy+SPA image
scripts/                 build image · run-local · smoke · ràng buộc nguồn
docs/                    requirements.md · design.md · deploy.md
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
