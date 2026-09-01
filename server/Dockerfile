# Một image cho CẢ HAI vai: service api-* chạy src/index.ts, service worker chạy
# src/worker.ts (design.md §1). Chạy bằng tsx — không bước build, như imath-test.
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY drizzle ./drizzle

# node làm PID 1 để nhận SIGTERM (drain êm khi blue/green đổi màu).
CMD ["node", "--import", "tsx", "src/index.ts"]
