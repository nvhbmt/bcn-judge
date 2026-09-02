import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5174,
    /**
     * Cho phép Host là tên miền tunnel, để gửi bản dev cho người thử.
     *
     * Vite CHẶN mọi request có `Host` lạ (vá DNS-rebinding từ 5.4.12) và trả đúng một
     * dòng "Blocked request. This host is not allowed." — trang trắng, không có gợi ý
     * nào dẫn tới đây. Đây là thứ đầu tiên hỏng khi mở tunnel vào máy dev.
     *
     * Liệt kê ĐÍCH DANH chứ không đặt `true`: `true` là tắt hẳn lớp vá đó, và khi ấy
     * bất kỳ trang web nào bạn mở cũng trỏ được DNS về 127.0.0.1:5174 để đọc mã nguồn.
     *
     * Tunnel có tên miền riêng thì khai qua env, đừng ghim vào file — tên miền là việc
     * của từng người chạy, không phải của dự án:
     *
     *     BCN_DEV_HOST=thu.clb.vn npm run dev
     */
    allowedHosts: [
      '.trycloudflare.com',
      '.ngrok-free.app',
      ...(process.env.BCN_DEV_HOST ? [process.env.BCN_DEV_HOST] : []),
    ],
    proxy: {
      // Dev: SPA gọi cùng origin; production build phải để VITE_API_BASE_URL=""
      '/api': 'http://localhost:8099',
      '/auth': 'http://localhost:8099',
      '/healthz': 'http://localhost:8099',
    },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
})
