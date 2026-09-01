/**
 * E2E trên trình duyệt thật cho toàn bộ luồng giao diện.
 *
 * Khác ba bộ đã có: `smoke.mjs` và `judge-e2e.mjs` gọi HTTP thẳng, `npm test` chạy
 * component trong jsdom. Bộ này lái Chromium thật, nên nó là thứ duy nhất bắt được
 * lỗi ở lớp giữa: route không link tới đâu, class Tailwind không sinh ra CSS, form
 * không submit, panel không đổi khi bấm icon rail.
 */
import { defineConfig, devices } from '@playwright/test'

const VITE_PORT = process.env.E2E_VITE_PORT ?? '5199'

export default defineConfig({
  testDir: './e2e',
  // Nộp bài đi qua Docker thật nên chậm; cho rộng tay nhưng không vô hạn.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Tuần tự: cả bộ dùng CHUNG một database và một hàng đợi chấm. Chạy song song
  // là hai test cùng sửa một khoá học rồi đổ lỗi cho nhau.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${VITE_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'vi-VN',
  },
  projects: [
    // Đăng nhập sẵn từng vai trò rồi cất cookie — xem e2e/auth.setup.ts.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    // Luồng đăng nhập tự nó phải bắt đầu từ trạng thái CHƯA đăng nhập.
    {
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testIgnore: /auth\.(spec|setup)\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'bash scripts/e2e-stack.sh',
    // Trỏ vào /healthz (vite proxy sang API) chứ không phải trang chủ: cổng vite
    // sống không có nghĩa API còn sống.
    url: `http://localhost:${VITE_PORT}/healthz`,
    // KHÔNG tái dùng stack cũ. Playwright chỉ thăm dò một cổng, nên nó không biết
    // API và worker của lần chạy trước đã bị giết cùng process group — chạy tiếp
    // trên xác đó cho ra kết quả sai (worker "chết" trong khi test tưởng nó sống).
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
