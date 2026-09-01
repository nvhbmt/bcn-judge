#!/usr/bin/env bash
# Dựng nguyên stack cho bộ E2E giao diện: Postgres sạch → migrate → seed nền →
# seed dữ liệu mẫu → API → worker → vite.
#
# Playwright gọi file này qua `webServer` và chờ cổng vite. Tiến trình con chạy
# trong CÙNG process group nên Playwright dọn sạch khi xong.
#
# Vì sao dùng database RIÊNG (`bcn_judge_e2e_ui`): bộ test tạo tài khoản, khoá,
# bài tập và nộp bài thật. Chạy trên DB dev sẽ trộn lẫn với dữ liệu đang xem tay.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_CONTAINER="${PG_CONTAINER:-bcn-judge-pg}"
DB="${E2E_DB:-bcn_judge_e2e_ui}"
export DATABASE_URL="postgres://bcn:bcn@localhost:5434/${DB}"
export PORT="${E2E_API_PORT:-8399}"
VITE_PORT="${E2E_VITE_PORT:-5199}"

# Dọn tiến trình sót của lần chạy trước TRƯỚC khi làm gì khác.
#
# Đây là nguyên nhân thứ hai của lỗi "[vite] http proxy error ... ECONNREFUSED", và nó
# khó thấy hơn cái đua khởi động: nếu vite cũ còn giữ cổng 5199 thì vite mới chết ngay
# ("Port 5199 is already in use"), nhưng Playwright vẫn thấy cổng 5199 có người trả
# lời nên cứ chạy tiếp — trên con vite CŨ, đang proxy sang một API đã chết. Mọi request
# từ đó về sau đều ECONNREFUSED, và log lại không hề nói vite mới đã chết.
#
# Hai cổng này chỉ dành cho bộ E2E (dev dùng 5174/8099) nên giết người đang giữ chúng
# là an toàn — chính là stack E2E lần trước.
#
# Đoạn này chủ yếu cứu đường chạy TAY (`bash scripts/e2e-stack.sh`). Dưới Playwright,
# `reuseExistingServer: false` làm Playwright dừng ngay với "port is already used" trước
# khi gọi script — lỗi đó đã rõ ràng nên không cần cứu.
for port in "${VITE_PORT}" "${PORT}"; do
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "[e2e] cổng $port còn tiến trình cũ ($pids) — dọn"
    kill $pids 2>/dev/null || true
    # PHẢI chờ chúng chết hẳn, không chỉ gửi tín hiệu rồi đi tiếp: API có graceful
    # shutdown tới 10 giây, và chừng nào nó chưa nhả kết nối Postgres thì DROP DATABASE
    # bên dưới sẽ thất bại với "is being accessed by other users".
    for _ in $(seq 1 40); do
      pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
      if [ -z "$pids" ]; then break; fi
      sleep 0.25
    done
    if [ -n "$pids" ]; then
      echo "[e2e] cổng $port không tự nhả — buộc dừng"
      kill -9 $pids 2>/dev/null || true
      sleep 0.5
    fi
  fi
done

echo "[e2e] dựng database $DB"
# Ngắt mọi kết nối còn sót TRƯỚC khi DROP. Vòng chờ ở trên lo các tiến trình mình biết,
# nhưng một tiến trình bị SIGKILL có thể để lại backend Postgres còn treo vài giây —
# và chỉ cần một cái là DROP DATABASE hỏng.
docker exec "$PG_CONTAINER" psql -U bcn -d postgres -tAc \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB}' AND pid <> pg_backend_pid()" >/dev/null 2>&1 || true
docker exec "$PG_CONTAINER" psql -U bcn -d postgres -c "DROP DATABASE IF EXISTS ${DB}" >/dev/null
docker exec "$PG_CONTAINER" psql -U bcn -d postgres -c "CREATE DATABASE ${DB}" >/dev/null

cd "$ROOT/server"
npm run db:migrate >/dev/null
npm run db:seed >/dev/null
# Dữ liệu mẫu cho những màn cần "có người dùng": tiến độ, bảng xếp hạng, contest.
npm run db:seed:demo -- --reset >/dev/null
# Bật đủ 5 ngôn ngữ để test nộp bài chọn được ngôn ngữ nào cũng có.
docker exec "$PG_CONTAINER" psql -U bcn -d "$DB" -tAc \
  "UPDATE languages SET enabled = true" >/dev/null
# Admin của bộ test bỏ qua bước đổi mật khẩu lần đầu; luồng đó có test riêng
# dùng một tài khoản mới tinh, xem auth.spec.ts.
docker exec "$PG_CONTAINER" psql -U bcn -d "$DB" -tAc \
  "UPDATE users SET must_change_password = false WHERE email = 'admin@bcn.local'" >/dev/null

echo "[e2e] API :$PORT"
node --import tsx src/index.ts &
API_PID=$!
echo "[e2e] worker (2 slot)"
WORKER_SLOTS=2 node --import tsx src/worker.ts &

# CHỜ API mở cổng rồi mới bật vite. Không có vòng chờ này thì hai tiến trình đua nhau
# và khoảng cách đo được chỉ ~0,06 giây — tức là tung đồng xu. Ai thua thì vite lên
# trước, và mọi request trong cửa sổ đó nhận:
#     [vite] http proxy error: /auth/login  AggregateError [ECONNREFUSED]
#
# Playwright KHÔNG cứu được chỗ này dù `webServer.url` đã trỏ qua proxy vào /healthz:
# lúc API chưa lên, vite trả 500 chứ không phải lỗi kết nối, nên Playwright coi là
# "sẵn sàng" và bắn ngay — mà việc đầu tiên của bộ test là 4 lần đăng nhập.
#
# Bật vite SAU khi API trả lời thì cổng vite sống đồng nghĩa API sống, cho cả
# Playwright lẫn người mở trình duyệt bằng tay.
printf '[e2e] chờ API'
for _ in $(seq 1 120); do
  if curl -fsS "http://localhost:${PORT}/healthz" >/dev/null 2>&1; then
    echo " · sẵn sàng"
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo
    echo "[e2e] API chết khi khởi động — xem log phía trên" >&2
    exit 1
  fi
  printf '.'
  sleep 0.5
done

cd "$ROOT"
echo "[e2e] vite :$VITE_PORT"
exec npx vite --config e2e/vite.e2e.config.ts --port "$VITE_PORT" --strictPort
