/** Vite cho bộ E2E: proxy sang API của stack E2E (:8399), không phải :8099 của dev. */
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const API = `http://localhost:${process.env.E2E_API_PORT ?? 8399}`

export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  server: { proxy: { '/api': API, '/auth': API, '/healthz': API } },
})
