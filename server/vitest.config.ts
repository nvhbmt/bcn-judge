import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Bộ sandbox chạy container thật: chậm và tuần tự (mỗi ca một container).
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
})
