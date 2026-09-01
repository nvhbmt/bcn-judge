/** Điểm vào API (graceful shutdown theo mẫu imath). */
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { config } from './config'
import { closePool } from './db/pool'

const server = serve({ fetch: createApp().fetch, port: config.port }, (info) => {
  console.log(`[api] http://localhost:${info.port}`)
})

let shuttingDown = false
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`[api] ${signal} — đang đóng`)
    server.close(() => {
      void closePool().finally(() => process.exit(0))
    })
    setTimeout(() => process.exit(1), 10_000).unref()
  })
}
