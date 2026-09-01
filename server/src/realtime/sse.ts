/**
 * Helper SSE cho các route realtime (§4.3, ADR-7):
 *   GET /api/member/submissions/:id/events   → `result` từng testcase + `done`
 *   GET /api/member/contests/:id/events      → `started` / `standings.changed`
 *
 * Ba bất biến của §4.3 nằm trong file này:
 *
 *  1. **Không mất event qua reconnect.** `Last-Event-ID` (hoặc `?lastEventId=`)
 *     → `replay(sinceSeq)` đọc thẳng từ DB (`submission_results` /
 *     `contest_events`) TRƯỚC khi phát live. Đây là thứ đỡ cả cú flip
 *     blue/green giữa contest: sự kiện không được chỉ tồn tại trong RAM.
 *  2. **Đăng ký bus TRƯỚC khi replay.** Ngược lại có khe hở: event phát trong
 *     lúc truy vấn replay đang chạy thì không ai nhận. Persist-trước-notify-sau
 *     chỉ đóng khe hở phía DB, không đóng khe hở phía process.
 *  3. **Bus câm thì đóng stream, không thả keep-alive.** Keep-alive do chính API
 *     sinh làm `EventSource` phía member trông "khoẻ" trong khi không còn event
 *     nào tới nữa — đúng chế độ hỏng câm mà bus tự lành để tránh. Đóng stream
 *     thì client reconnect + replay (hoặc rơi về polling 2 s) và tự hội tụ.
 *
 * Serializer vẫn là ranh giới rò rỉ: route phải `publish()` payload đã đi qua
 * `toMember*` (NFR-2) — helper này không lọc gì, nó chỉ vận chuyển.
 */
import type { Context } from 'hono'
import type { SSEMessage } from 'hono/streaming'
import { streamSSE } from 'hono/streaming'
import { busStatus, onConnectionLost, subscribe } from './bus'

/** Comment keep-alive: Cloudflare/Caddy/proxy công ty buffer stream im lặng rồi
 *  cắt sau ~30–60 s. 20 s nằm dưới mọi ngưỡng đó (§4.3). */
const KEEPALIVE_MS = 20_000

export interface ReplayEvent {
  seq: number
  kind: string
  payload: unknown
}

export interface SseOptions {
  /** Kênh logic của bus cần nghe (vd. `submission:<id>`, `contest:<id>`). */
  channels: string[]
  /** Ưu tiên hơn header `Last-Event-ID` và query `?lastEventId=`. */
  lastEventId?: number
  replay?: (sinceSeq: number) => Promise<ReplayEvent[]>
}

interface Pending {
  /** Con trỏ replay của kênh — có thì gửi kèm làm `id:` của event SSE. */
  seq: number | undefined
  sse: SSEMessage
}

export function sseStream(c: Context, opts: SseOptions): Response {
  const since = resolveLastEventId(c, opts.lastEventId)

  return streamSSE(c, async (stream) => {
    const queue: Pending[] = []
    const cleanups: Array<() => void> = []
    let alive = true
    let wake: (() => void) | null = null

    const push = (channel: string, payload: unknown): void => {
      queue.push(toPending(channel, payload))
      wake?.()
    }
    const stop = (): void => {
      alive = false
      wake?.()
    }
    /** true = có event; false = hết 20 s im lặng. */
    const waitEvent = (ms: number): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          wake = null
          resolve(false)
        }, ms)
        wake = () => {
          wake = null
          clearTimeout(timer)
          resolve(true)
        }
      })

    // Bất biến 2: đăng ký trước, replay sau.
    for (const channel of opts.channels) {
      cleanups.push(subscribe(channel, (payload) => push(channel, payload)))
    }
    // Bus mất kết nối ⇒ đóng stream; client reconnect kèm Last-Event-ID (§4.3 (a)).
    cleanups.push(onConnectionLost(stop))

    stream.onAbort(stop)
    const signal = c.req.raw.signal as AbortSignal | undefined
    if (signal) {
      if (signal.aborted) stop()
      else {
        signal.addEventListener('abort', stop)
        cleanups.push(() => signal.removeEventListener('abort', stop))
      }
    }

    try {
      // 1. Replay: không verdict/standings nào được rơi qua một lần reconnect.
      let sentSeq = -1
      if (since !== null && opts.replay) {
        for (const ev of await opts.replay(since)) {
          if (!alive) return
          await stream.writeSSE({ id: String(ev.seq), event: ev.kind, data: JSON.stringify(ev.payload) })
          if (ev.seq > sentSeq) sentSeq = ev.seq
        }
      }

      // 2. Xả những gì bus gửi tới trong lúc replay chạy, bỏ phần replay đã phủ.
      //    Lọc theo seq CHỈ ở đây: sau đó seq không còn đơn điệu bắt buộc nữa
      //    (kênh submission dùng seq của submission cho mọi frame testcase).
      for (const pending of queue.splice(0, queue.length)) {
        if (!alive) return
        if (pending.seq !== undefined && pending.seq <= sentSeq) continue
        await stream.writeSSE(pending.sse)
      }

      // 3. Vòng sống.
      while (alive && !stream.closed && !stream.aborted) {
        const pending = queue.shift()
        if (pending) {
          await stream.writeSSE(pending.sse)
          continue
        }
        if (await waitEvent(KEEPALIVE_MS)) continue
        if (!busStatus().connected) break // bất biến 3
        await stream.write(': ka\n\n')
      }
    } finally {
      for (const off of cleanups) off()
      queue.length = 0
    }
  })
}

function resolveLastEventId(c: Context, explicit?: number): number | null {
  const raw = explicit ?? c.req.header('Last-Event-ID') ?? c.req.query('lastEventId')
  if (raw === undefined || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

/**
 * Hình dạng event: `payload.kind` là tên event SSE (rơi về tên kênh nếu thiếu),
 * `payload.seq` là `id:` — con trỏ mà client gửi lại trong `Last-Event-ID`.
 */
function toPending(channel: string, payload: unknown): Pending {
  const obj = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const kind = typeof obj.kind === 'string' ? obj.kind : channel
  const seq = typeof obj.seq === 'number' && Number.isFinite(obj.seq) ? obj.seq : undefined
  return {
    seq,
    sse: {
      event: kind,
      data: JSON.stringify(payload ?? null),
      ...(seq === undefined ? {} : { id: String(seq) }),
    },
  }
}
