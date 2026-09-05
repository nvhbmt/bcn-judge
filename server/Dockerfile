# Một image cho CẢ HAI vai: service api-* chạy src/index.ts, service worker chạy
# src/worker.ts (design.md §1). Chạy bằng tsx — không bước build, như imath-test.
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# tsconfig.json PHẢI vào image: tsx giải `@/…` bằng `paths` trong đó, tìm từ cwd
# (/app). Thiếu file này thì container chết ngay ở import đầu tiên — "Cannot find
# module '@/config'" — mà `npm test` và `tsc` ở máy dev vẫn xanh vì chúng đọc được
# tsconfig từ cây nguồn.
COPY tsconfig.json ./
COPY src ./src
COPY drizzle ./drizzle

# node làm PID 1 để nhận SIGTERM (drain êm khi blue/green đổi màu).
CMD ["node", "--import", "tsx", "src/index.ts"]
