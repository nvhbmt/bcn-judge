#!/usr/bin/env bash
# Chạy full stack ở máy dev: Postgres (docker) + migrate + seed + API + worker + SPA.
# Mẫu từ imath-test/scripts/run-local.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_NAME=bcn-judge-pg
PG_PORT=5434
DB_URL="postgres://bcn:bcn@localhost:${PG_PORT}/bcn_judge"

echo "==> Postgres"
if ! docker ps --format '{{.Names}}' | grep -qx "$PG_NAME"; then
  docker rm -f "$PG_NAME" >/dev/null 2>&1 || true
  docker run -d --name "$PG_NAME" \
    -e POSTGRES_USER=bcn -e POSTGRES_PASSWORD=bcn -e POSTGRES_DB=bcn_judge \
    -p "${PG_PORT}:5432" postgres:17-alpine >/dev/null
  printf '    đợi Postgres'
  until docker exec "$PG_NAME" pg_isready -U bcn -q 2>/dev/null; do printf '.'; sleep 1; done
  echo
fi
docker exec "$PG_NAME" psql -U bcn -d postgres -c 'CREATE DATABASE bcn_judge_test' >/dev/null 2>&1 || true

echo "==> Runner image"
docker image inspect bcnjudge-runner-gcc:14 >/dev/null 2>&1 || bash "$ROOT/scripts/build-runner-images.sh"

echo "==> Migrate + seed + grants"
cd "$ROOT/server"
DATABASE_URL="$DB_URL" npm run --silent db:migrate
DATABASE_URL="$DB_URL" npm run --silent db:seed
DATABASE_URL="$DB_URL" npm run --silent db:grants || true

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "==> API :8099"
DATABASE_URL="$DB_URL" npm run --silent dev &

echo "==> Worker"
DATABASE_URL="$DB_URL" node --import tsx src/worker.ts &

echo "==> SPA :5174"
cd "$ROOT"
npm run --silent dev &

echo
echo "    SPA    http://localhost:5174"
echo "    API    http://localhost:8099/healthz"
echo "    Admin  admin@bcn.local / bcnjudge"
wait
