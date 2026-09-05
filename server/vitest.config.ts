import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Vite KHÔNG đọc `paths` của tsconfig — phải khai lại ở đây, nếu không thì tsc
  // xanh mà `npm test` đỏ với "Failed to resolve import @/…". Cùng một alias, hai
  // nơi khai, nên đổi một chỗ là phải đổi cả chỗ kia.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // Bộ sandbox chạy container thật: chậm và tuần tự (mỗi ca một container).
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
})
