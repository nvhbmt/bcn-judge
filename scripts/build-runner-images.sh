#!/usr/bin/env bash
# Build các runner image (design.md §3.1). Chạy: bash scripts/build-runner-images.sh
set -euo pipefail

cd "$(dirname "$0")/../server/runner/images"

echo "==> bcnjudge-runner-gcc:14"
docker build -q -t bcnjudge-runner-gcc:14 -f gcc/Dockerfile .

echo "==> bcnjudge-runner-python:3.12"
docker build -q -t bcnjudge-runner-python:3.12 -f python/Dockerfile .

echo "==> xong"
docker image ls --filter reference='bcnjudge-runner-*' \
  --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'
