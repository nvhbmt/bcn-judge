# Deploy BCN Judge lên VPS

Toàn hệ thống chạy trên **một VPS**, dựng bằng `docker compose`. Tài liệu này đi từ máy
trắng tới lúc member đăng nhập được, rồi tới quy trình cập nhật hằng ngày.

Kiến trúc và lý do từng lựa chọn nằm ở [`design.md`](design.md) §9 và ADR-5/ADR-11.

---

## 0. Chuẩn bị

| Cần gì | Ghi chú |
|---|---|
| VPS Debian/Ubuntu | **8 vCPU · 16 GB · 40 GB SSD** cho 120 thành viên — xem bảng trong [README](../README.md) |
| Tên miền trỏ A/AAAA về VPS | Caddy tự xin chứng chỉ Let's Encrypt |
| Cổng 80 và 443 mở | Cổng 80 bắt buộc, dùng cho ACME |

**Đừng dùng vCPU burstable có hạn mức tín dụng** (t2/t3 khi cạn credit). TLE tính theo
giờ CPU nên nhiễu ít gây oan, nhưng vẫn còn chốt giờ tường ở `2T + 2s`: CPU bị bóp
xuống 5–20 % sẽ giết oan bài làm đúng.

---

## 1. Chuẩn bị máy (một lần)

```bash
git clone <repo> bcn-judge && cd bcn-judge
sudo bash server/deploy/provision-vps.sh
```

Script làm bốn việc, mỗi việc đều có lý do cụ thể:

- **Cài Docker** nếu chưa có.
- **`user.max_user_namespaces=0`** và **`kernel.apparmor_restrict_unprivileged_userns=1`** —
  cắt lối leo thang qua user namespace không đặc quyền. Đây là lớp ngoài container, bổ
  cho `--cap-drop ALL` + `no-new-privileges` bên trong.
- **chrony** — cả hệ contest treo trên `now()`. Lệch giờ host là lệch giờ mở đề và giờ
  chốt sổ.
- **Kéo base image** cho runner.

---

## 2. Cấu hình bí mật

Secret **tách theo service** (ADR-5): worker không được cầm `SESSION_SECRET` hay
`DATABASE_URL` của app, để worker bị chiếm cũng không đi vòng qua ba role Postgres.

```bash
cd server
cp .env.example .env            # cho docker compose: POSTGRES_*, BCN_DOMAIN
```

Rồi tạo ba file riêng — `.env.api`, `.env.worker`, `.env.migrate` — theo đúng ba khối
ghi trong `.env.example`. Ba role Postgres khác nhau, không dùng lại một chuỗi kết nối:

| File | Role | Quyền |
|---|---|---|
| `.env.migrate` | `bcn_migrate` | DDL |
| `.env.api` | `bcn_app` | đọc/ghi dữ liệu ứng dụng |
| `.env.worker` | `bcn_worker` | **không** grant nào trên `users`, `user_sessions`, `settings`, `audit_log` |

Trong `.env` nhớ đặt:

```bash
BCN_DOMAIN=judge.clb.vn      # Caddy dùng để xin chứng chỉ
POSTGRES_PASSWORD=<mật khẩu mạnh>
```

Trong `.env.worker`, `WORKER_SLOTS` đặt bằng **nửa số vCPU** (8 vCPU → `WORKER_SLOTS=4`).
Mỗi container ghim `NanoCpus = 1`, nên slot nhiều hơn nửa số nhân làm tổng thông lượng
tụt chứ không tăng.

---

## 3. Dựng runner image

```bash
bash scripts/build-runner-images.sh --all
```

Bốn image ngôn ngữ, khoảng 1,7 GB. Bỏ `--all` thì chỉ dựng gcc + python.

**Quy ước bắt buộc**: runner image tự đưa toolchain lên PATH chuẩn. Đây là bài học đã
trả giá ba lần (python ở `/usr/local/bin`, JDK ở `/opt/java/openjdk/bin`) — không nới
PATH của sandbox theo từng ngôn ngữ.

---

## 4. Migrate và cấp quyền

```bash
cd server
docker compose run --rm migrate
docker compose run --rm --entrypoint node migrate --import tsx src/db/grants.ts
```

Bước `grants` **không được bỏ**: bảng mới sinh ra mà quên grant thì không lỗi lúc
migrate, chỉ nổ lúc runtime khi có người dùng thật chạm vào.

---

## 5. Seed nền

Migrate chỉ dựng bảng rỗng. Seed nền tạo **ngôn ngữ chấm, settings mặc định và admin
đầu tiên** — thiếu bước này thì hệ thống lên nhưng không ai đăng nhập được và cũng
không có ngôn ngữ nào để nộp.

```bash
SEED_ADMIN_EMAIL=admin@clb.vn SEED_ADMIN_PASSWORD='<mật khẩu tạm mạnh>' \
  docker compose run --rm --entrypoint node migrate --import tsx src/db/seed.ts
```

**Đặt hai biến này**, đừng dùng mặc định `admin@bcn.local / bcnjudge` — nó nằm công
khai trong mã nguồn. Tài khoản tạo ra mang cờ `mustChangePassword`, nên lần đăng nhập
đầu hệ thống bắt đổi mật khẩu trước khi cho đi đâu (FR-A2).

Seed chạy lại được: nó `onConflictDoNothing`, admin đã có thì bỏ qua.

Dữ liệu mẫu (`db:seed:demo`) là để xem giao diện lúc "có người dùng" — **đừng chạy trên
máy thật**, và script cũng tự từ chối nếu `DATABASE_URL` không trông giống máy dev.

---

## 6. Khởi động

```bash
docker compose up -d
curl -s localhost/healthz     # {"status":"ok","db":"up"}
```

---

## 7. Sao lưu

```bash
crontab -e
# 0 3 * * * cd /path/bcn-judge/server && bash deploy/backup.sh
```

Một `pg_dump` phủ **cả database lẫn testcase**, vì testcase là `bytea` trong Postgres
(ADR-8) — không có kho file thứ hai để quên. Script tự `pg_restore --list` để kiểm bản
dump ngay sau khi tạo: dump hỏng lọt qua 90 ngày là kịch bản có thật.

Hai biến nên đặt:

- `BCN_AGE_RECIPIENT` — mã hoá kèm `.env.*` vào bản sao lưu. **Mất `TOTP_ENC_KEY` là
  `totp_secret` thành rác không giải được.**
- `BCN_RCLONE_REMOTE` — đẩy off-box. Sao lưu nằm cùng máy với dữ liệu gốc không phải
  sao lưu.

---

## 8. Cập nhật hằng ngày

```bash
cd server
bash deploy/deploy.sh              # đầy đủ: API (blue/green) + worker + giao diện
bash deploy/deploy.sh --spa-only   # chỉ giao diện, không đụng judge/DB
```

Trình tự của bản đầy đủ:

1. **Cổng migration** — `check-migrations-safe.sh` chặn `DROP COLUMN` / `RENAME` /
   `ALTER COLUMN … TYPE`. Blue/green nghĩa là mã cũ và mã mới chạy đồng thời vài giây;
   một `DROP COLUMN` làm mã cũ nổ ngay. Cố ý thì thêm dòng `-- migration-safe: ok` vào
   file SQL và deploy ngoài giờ contest.
2. Build image, migrate, cấp lại grants.
3. **Lật blue/green**: dựng màu còn lại, đợi healthcheck, trỏ Caddy sang, rồi mới tắt
   màu cũ. Healthcheck hỏng thì dừng deploy và giữ nguyên màu đang chạy.
4. **Khởi động lại worker** — worker *không* blue/green (ADR-11): NFR-5 cho phép judge
   ngưng ngắn, nên nhân đôi bộ phận chuyển động để tiết kiệm ~50 giây là sai chiều đánh
   đổi. `stop_grace_period: 90s` cho worker chấm nốt testcase hiện tại rồi tự trả bài về
   hàng đợi; member chỉ thấy chậm chứ không mất bài.

Giao diện nằm **trong image caddy** (`deploy/Caddy.Dockerfile` build SPA ở tầng đầu rồi
copy `dist` sang tầng caddy). Vì vậy `--spa-only` chỉ dựng lại đúng image đó — không
migration, không lật màu, không đụng worker. Caddy gián đoạn dưới một giây lúc thay
container; SSE đang mở tự nối lại.

### `VITE_API_BASE_URL` phải RỖNG

Dockerfile đã ghim `ENV VITE_API_BASE_URL=""`. SPA và API dùng chung origin sau Caddy
nên base rỗng cho ra đường dẫn tương đối. Đặt một host cụ thể vào đây là bundle
production đi gọi thẳng máy đó, bỏ qua reverse proxy.

---

## 9. Trước khi mở cho member — nợ P0 bắt buộc trả

Mọi số đo hiệu năng và **toàn bộ bộ abuse hiện mới chạy trên máy dev (OrbStack)**.
`design.md` §11 yêu cầu chạy lại trên **đúng kernel/Docker của VPS đích**:

> Chuyện có thật cho thấy vì sao món nợ này không được quên: bộ abuse từng đỏ ở ca
> vệ sinh suốt một thời gian mà không ai biết — bể container ấm (pool.ts) ra đời sau
> phép đếm "không sót container", và vì bộ chỉ chạy khi `DOCKER=1` nên không lượt CI
> thường nào đụng tới. Đã sửa (05.09.2026, các suite tự xả bể khi xong, 48/48 xanh,
> 0 container sót), nhưng bài học đứng nguyên: **bộ này phải được chạy chủ động, nó
> không tự kêu khi hỏng.**

```bash
cd server && DOCKER=1 npm run test:sandbox
```

Ba hành vi phải xác nhận lại vì chúng khác nhau giữa các kernel, và cả ba đều **hỏng
im lặng** — không exception, chỉ là verdict sai:

1. `docker update --memory` có thật sự thu hẹp được cgroup đang chạy không.
2. `memory.events` có đọc được trong namespace không (dùng để phân biệt MLE với RE).
3. `exec` stdin có half-close thật không (testcase vào bằng stdin; không EOF là mọi bài
   đọc tới hết input sẽ treo).

`provision-vps.sh` in nhắc nhở này ở bước cuối.

---

## 10. Kiểm chứng sau deploy

```bash
curl -s https://judge.clb.vn/healthz
node scripts/smoke.mjs                 # cấp tài khoản → soạn bài → nộp → chấm → verdict
```

Xem tình trạng chấm ở `/quan-tri`: worker phải "sống" (có báo hiệu trong 30 giây) và
hàng đợi không được dồn.

Kiểm nhanh đường realtime — verdict phải về trong khoảng một giây, không phải sáu:

```bash
docker compose logs -f worker | grep 'chờ'
```

`chờ` là thời gian bài nằm trong hàng đợi trước khi worker nhặt. Con số này phải cỡ
**chục mili giây**. Lên tới ~500 ms nghĩa là chuông LISTEN/NOTIFY không tới và hệ thống
đang chạy bằng nhịp poll dự phòng 1 giây.

Cuối cùng, mở trang bằng trình duyệt thật và nhìn **mặt chữ**: tiêu đề phải là chữ có
chân (Lora), số và verdict phải là mono (IBM Plex Mono). Nếu cả trang là font hệ thống
thì CSP đang chặn Google Fonts — dev không có CSP nên lỗi này **chỉ** hiện sau deploy,
và nó chặn câm, không log gì. Đối chiếu `style-src`/`font-src` trong `server/Caddyfile`
với các thẻ `<link>` trong `index.html`.

---

## 11. Gỡ rối

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Trang trắng, API vẫn `/healthz` ok | Image caddy dựng từ trước khi có bước build SPA — chạy `bash deploy/deploy.sh --spa-only` |
| Không xin được chứng chỉ | `BCN_DOMAIN` chưa đặt trong `.env`, hoặc cổng 80 bị chặn |
| Lật blue/green xong site chết | `BCN_API_UPSTREAM` không tới được container caddy — phải khai ở `environment:` của service, không phải chỉ là biến shell |
| Verdict về sau đúng ~6 giây | SSE không tới trình duyệt; hệ thống đang chạy bằng polling dự phòng |
| Mọi bài Python thành CE | PATH của image thiếu `/usr/local/bin`, hoặc `setpriv --bounding-set` hỏng — xem `bset` trong dòng meta |
| Container sandbox chất đống | Worker chết bằng SIGKILL; lần khởi động sau tự dọn container của worker đã chết |

Nhật ký:

```bash
docker compose logs -f api-blue worker caddy
docker compose ps
```
