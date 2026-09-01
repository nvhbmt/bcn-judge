#!/usr/bin/env bash
# Chuẩn bị VPS lần đầu (design.md §9, ADR-5). Chạy với sudo trên máy Debian/Ubuntu.
set -euo pipefail

echo "==> Docker"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh

echo "==> Sysctl siết user namespace (tầng host của ADR-5)"
# Sandbox đã --cap-drop ALL + no-new-privileges; hai khoá này cắt luôn lối leo
# thang qua unprivileged user namespace — lớp bảo vệ ngoài container.
cat >/etc/sysctl.d/99-bcn-judge.conf <<'EOF'
user.max_user_namespaces=0
kernel.apparmor_restrict_unprivileged_userns=1
EOF
sysctl --system >/dev/null

echo "==> chrony (đồng hồ)"
# Cả hệ contest treo trên now(): lệch giờ host là lệch giờ mở đề và giờ chốt sổ.
apt-get update -qq && apt-get install -y -qq chrony >/dev/null
systemctl enable --now chrony

echo "==> Kéo runner image"
docker pull debian:bookworm-slim
docker pull python:3.12-slim

echo "==> Kiểm tra"
docker info --format 'cgroup {{.CgroupVersion}} / driver {{.CgroupDriver}}'
chronyc tracking | grep -E 'System time|Leap' || true
sysctl user.max_user_namespaces

cat <<'EOF'

Còn lại làm tay:
  1. Sao .env.example thành .env.api / .env.worker / .env.migrate, đổi mật khẩu
  2. bash scripts/build-runner-images.sh
  3. docker compose run --rm migrate && docker compose run --rm --entrypoint node migrate --import tsx src/db/grants.ts
  4. docker compose up -d
  5. Cron: 0 3 * * * bash deploy/backup.sh
  6. Chạy bộ abuse TRÊN CHÍNH VPS NÀY trước khi mở cho member:
       cd server && DOCKER=1 npm run test:sandbox
     — đây là nợ P0 có tên trong design §14: mọi số đo hiện tại đo trên máy dev.
EOF
