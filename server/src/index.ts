/** Điểm vào API (graceful shutdown theo mẫu imath). */
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { config } from './config'
import { startDiscordSweep } from '@/auth/discordSweep'
import { closePool } from '@/db/pool'
import { startBus, stopBus } from '@/realtime/bus'

// Bus lười và không bao giờ ném: mất LISTEN thì SSE tự hạ xuống polling (§4.3).
await startBus()
// Ở API chứ không ở worker: DISCORD_* nằm trong .env.api, và chỉ role của API được UPDATE users.
const stopDiscordSweep = startDiscordSweep()

const server = serve({ fetch: createApp().fetch, port: config.port }, (info) => {
  console.log(`[api] http://localhost:${info.port}`)
})

let shuttingDown = false
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`[api] ${signal} — đang đóng`)
    stopDiscordSweep()
    server.close(() => {
      void stopBus()
        .then(closePool)
        .finally(() => process.exit(0))
    })
    setTimeout(() => process.exit(1), 10_000).unref()
  })
}
