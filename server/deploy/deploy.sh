#!/usr/bin/env bash
# Deploy blue/green lên VPS (design.md §9). Chạy TRÊN VPS, trong thư mục server/.
#
#   bash deploy/deploy.sh            # deploy đầy đủ (API + worker + SPA)
#   bash deploy/deploy.sh --spa-only # chỉ dựng lại giao diện, không đụng judge/DB
set -euo pipefail

cd "$(dirname "$0")/.."
SPA_ONLY=${1:-}

# Chỉ SPA: image caddy chứa luôn bản build giao diện, nên dựng lại mỗi nó là xong.
# KHÔNG đụng migration, không lật blue/green, không khởi động lại worker — bài đang
# chấm chạy tiếp bình thường. Caddy có gián đoạn dưới một giây lúc thay container;
# kết nối SSE đang mở sẽ tự nối lại.
if [ "$SPA_ONLY" = "--spa-only" ]; then
  echo "==> Chỉ SPA: dựng lại image caddy"
  docker compose build caddy
  docker compose up -d caddy
  echo "==> Xong."
  exit 0
fi

echo "==> Kiểm tra migration an toàn"
bash deploy/check-migrations-safe.sh

echo "==> Build image"
docker compose build

echo "==> Migrate (một lần, không chạy song song)"
docker compose run --rm migrate

echo "==> Cấp lại grants (bảng mới sinh ra mà quên grant chỉ nổ lúc runtime)"
docker compose run --rm --entrypoint node migrate --import tsx src/db/grants.ts

# Xác định màu đang chạy để lật sang màu kia.
CURRENT=blue
if docker compose ps --services --filter status=running | grep -q '^api-green$'; then CURRENT=green; fi
TARGET=$([ "$CURRENT" = blue ] && echo green || echo blue)
echo "==> Đang chạy: api-$CURRENT → lật sang api-$TARGET"

docker compose --profile green up -d "api-$TARGET"

echo "==> Đợi healthcheck của api-$TARGET"
for i in $(seq 1 30); do
  if docker compose exec -T "api-$TARGET" node -e \
      "fetch('http://localhost:8099/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "    khoẻ sau ${i}s"; break
  fi
  [ "$i" = 30 ] && { echo "    api-$TARGET KHÔNG khoẻ — giữ nguyên $CURRENT, dừng deploy"; exit 1; }
  sleep 1
done

# `BCN_API_UPSTREAM` đi vào ENV CỦA CONTAINER caddy (compose khai nó ở service), chứ
# không phải chỉ là biến shell: Caddyfile đọc bằng cú pháp `{$VAR}` của Caddy, tức đọc
# từ tiến trình caddy. Thiếu bước này thì upstream mãi là api-blue và lật màu xong là
# trỏ vào container vừa tắt.
echo "==> Trỏ Caddy sang api-$TARGET (và cập nhật SPA)"
BCN_API_UPSTREAM="api-$TARGET:8099" docker compose up -d caddy
sleep 3
docker compose stop "api-$CURRENT"

if [ "$SPA_ONLY" != "--spa-only" ]; then
  # Worker KHÔNG blue/green (ADR-11): dừng êm 90 giây, bài đang chấm tự trả về
  # hàng đợi, member chỉ thấy chậm chứ không mất bài (NFR-5).
  echo "==> Khởi động lại worker"
  docker compose up -d --force-recreate worker
fi

echo "==> Xong. Kiểm tra: curl -s localhost/healthz"
echo "    Lưu ý: lần deploy sau phải chạy với BCN_API_UPSTREAM=api-$TARGET:8099 trong .env,"
echo "    hoặc để deploy.sh tự dò như vừa rồi."
