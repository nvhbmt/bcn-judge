#!/usr/bin/env bash
# Build runner image (design.md §3.1).
#   bash scripts/build-runner-images.sh          # hai image bắt buộc (FR-F7 M)
#   bash scripts/build-runner-images.sh --all    # thêm Java và Node (mức S)
set -euo pipefail

cd "$(dirname "$0")/../server/runner/images"

echo "==> bcnjudge-runner-gcc:14"
docker build -q -t bcnjudge-runner-gcc:14 -f gcc/Dockerfile .

echo "==> bcnjudge-runner-python:3.12"
docker build -q -t bcnjudge-runner-python:3.12 -f python/Dockerfile .

if [ "${1:-}" = "--all" ]; then
  echo "==> bcnjudge-runner-openjdk:17"
  docker build -q -t bcnjudge-runner-openjdk:17 -f openjdk/Dockerfile .
  echo "==> bcnjudge-runner-node:20"
  docker build -q -t bcnjudge-runner-node:20 -f node/Dockerfile .
  echo "    Bật trong trang quản trị: /quan-tri/cai-dat (US-8 — không cần deploy lại)"
fi

echo "==> xong"
docker image ls --filter reference='bcnjudge-runner-*' \
  --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'
