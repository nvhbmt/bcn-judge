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

echo "[e2e] dựng database $DB"
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
echo "[e2e] worker (2 slot)"
WORKER_SLOTS=2 node --import tsx src/worker.ts &

cd "$ROOT"
echo "[e2e] vite :$VITE_PORT"
exec npx vite --config e2e/vite.e2e.config.ts --port "$VITE_PORT" --strictPort
