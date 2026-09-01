#!/usr/bin/env bash
# Sao lưu hằng ngày (NFR-7, design.md §9). Cron: 0 3 * * * bash deploy/backup.sh
#
# Một `pg_dump` phủ CẢ database LẪN testcase (ADR-8: testcase là bytea trong
# Postgres) — không có kho file thứ hai để quên.
set -euo pipefail

cd "$(dirname "$0")/.."
STAMP=$(date +%Y%m%d-%H%M)
DIR=${BCN_BACKUP_DIR:-/var/backups/bcn-judge}
DUMP="$DIR/bcn-$STAMP.dump"
mkdir -p "$DIR"

echo "==> pg_dump"
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-bcn}" -Fc "${POSTGRES_DB:-bcn_judge}" > "$DUMP"

# Dump hỏng lọt qua 90 ngày là kịch bản có thật — verify trước khi đẩy đi.
echo "==> Verify"
docker compose exec -T postgres pg_restore --list < "$DUMP" > /dev/null

# .env chứa TOTP_ENC_KEY; mất nó thì totp_secret thành rác không giải được.
echo "==> Mã hoá .env kèm dump"
if command -v age >/dev/null && [ -n "${BCN_AGE_RECIPIENT:-}" ]; then
  tar czf - .env.api .env.worker .env.migrate 2>/dev/null |
    age -r "$BCN_AGE_RECIPIENT" > "$DIR/env-$STAMP.tar.gz.age"
else
  echo "    bỏ qua: chưa cấu hình age/BCN_AGE_RECIPIENT"
fi

if [ -n "${BCN_RCLONE_REMOTE:-}" ]; then
  echo "==> Đẩy off-box"
  rclone copy "$DIR" "$BCN_RCLONE_REMOTE" --include "*-$STAMP.*"
  # Chỉ giữ 2 bản local: dump chứa toàn bộ bytea testcase, để nhiều là đầy NVMe.
  ls -t "$DIR"/*.dump | tail -n +3 | xargs -r rm -f
fi

echo "==> Xong: $DUMP ($(du -h "$DUMP" | cut -f1))"
