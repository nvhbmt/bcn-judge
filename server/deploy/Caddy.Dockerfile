# Caddy + SPA build tĩnh, gộp trong MỘT image.
#
# Vì sao build SPA ở đây chứ không trên host: `provision-vps.sh` chỉ cài Docker và
# chrony, không cài Node. Bắt VPS phải có đúng phiên bản Node để deploy được giao diện
# là thêm một thứ phải trùng khớp giữa máy dev và máy thật, mà không đổi lại được gì.
#
# `VITE_API_BASE_URL` để RỖNG là bắt buộc: SPA và API dùng chung origin sau Caddy, nên
# base rỗng cho ra đường dẫn tương đối. Đặt một host cụ thể vào đây là bundle production
# đi gọi thẳng máy đó, bỏ qua reverse proxy.
FROM node:22-slim AS spa
WORKDIR /repo

# Cây gốc chứa SPA; `server/` là npm tree riêng và không tham gia bước này.
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json ./
COPY design-system ./design-system
COPY src ./src
# `npm run build` chạy `tsc -b` trước, mà tsconfig include cả `tests` — copy vào cho
# lệnh build giống hệt lệnh chạy ở máy dev. Tầng cuối chỉ lấy `dist`, nên không lọt
# vào image production.
COPY tests ./tests
ENV VITE_API_BASE_URL=""
RUN npm run build

FROM caddy:2-alpine
COPY --from=spa /repo/dist /srv/spa
