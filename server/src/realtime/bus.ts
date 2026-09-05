/**
 * Bus sự kiện của một API process, lót bằng LISTEN/NOTIFY của Postgres (§4.3, ADR-7).
 *
 * Vì sao một `pg.Client` riêng chứ không lấy từ pool: connection đang giữ LISTEN
 * không được trả về pool — pool sẽ giao nó cho query khác, và tệ hơn là đóng nó
 * lúc idle (`idleTimeoutMillis`), lúc đó LISTEN biến mất mà không ai báo. Đây là
 * connection duy nhất của process nằm ngoài pool. Chiều publish thì ngược lại:
 * `pg_notify` là query bình thường, đi qua pool là đúng.
 *
 * Vì sao chỉ MỘT kênh Postgres (`bcn_events`) mà không phải mỗi loại một kênh:
 * blue và green cùng LISTEN trong lúc deploy (ADR-11) — giữ số connection LISTEN
 * đúng bằng số process, và thêm kênh logic mới (submission/contest/standings)
 * không phải sửa lệnh LISTEN nữa. Kênh logic nằm trong envelope `{channel, payload}`.
 *
 * Vì sao bus phải TỰ LÀNH (sửa vòng 2, §4.3): client LISTEN chết là chế độ hỏng
 * *câm* — keep-alive 20 s do chính API sinh nên `EventSource` phía member vẫn
 * trông "khoẻ", fallback polling (chỉ bật khi EventSource lỗi) không bao giờ bật,
 * và mọi verdict sống + standings + event `started` mở đề T0 đóng băng cho tới
 * khi từng người tự reload. Đối sách ba dòng ở đây:
 *   (a) báo cho handler mất-kết-nối để SSE **đóng mọi stream** — client tự
 *       reconnect kèm `Last-Event-ID` và replay từ DB, đường tự lành rẻ nhất;
 *   (b) reconnect + re-LISTEN có backoff;
 *   (c) self-ping 30 s để bắt connection nửa-chết (không `error`, không `end`,
 *       nhưng cũng không deliver nữa) và xử nó đúng như (a)+(b).
 *
 * Bus là LAZY: `startBus()` gọi tường minh, và không nối được cũng không ném —
 * phần còn lại của app chạy bình thường, SSE degrade về polling (§4.3).
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { config } from '@/config'
import { pool } from '@/db/pool'

/** Kênh Postgres duy nhất; kênh logic nằm trong envelope. */
const PG_CHANNEL = 'bcn_events'

/** Kênh logic dành riêng cho self-ping — không bao giờ fan-out ra subscriber. */
const PING_CHANNEL = '__bus_ping'

/** NOTIFY của Postgres chết ở 8000 byte; chừa chỗ cho envelope + mã hoá. */
export const MAX_PAYLOAD_BYTES = 7500

const PING_MS = 30_000
const BACKOFF_MS = [500, 1_000, 2_000, 5_000, 10_000, 30_000] as const

export type BusHandler = (payload: unknown) => void

export interface BusStatus {
  connected: boolean
  subscribers: number
  lastEventAt: string | null
}

const subscribers = new Map<string, Set<BusHandler>>()
const lossHandlers = new Set<() => void>()

let client: pg.Client | null = null
/** Đời của connection: mọi event của đời cũ bị bỏ qua sau khi đã xử lý mất kết nối. */
let gen = 0
let connected = false
let stopped = true
let starting: Promise<void> | null = null
let backoff = 0
let pingTimer: NodeJS.Timeout | null = null
let reconnectTimer: NodeJS.Timeout | null = null
let pendingPing: string | null = null
let lastEventAt: string | null = null

// ───────────────────────────────────────────────────────────────── API công khai

/**
 * Phát một event ra mọi API process (blue **và** green).
 *
 * Payload phải nằm dưới `MAX_PAYLOAD_BYTES`. Quá khổ (stderr dài, diff lớn,
 * compile output của C++) thì KHÔNG ném đi mất: ta phát bản chỉ còn định danh
 * kèm `truncated: true` và để client refetch qua GET — NOTIFY chỉ là cái chuông,
 * `submission_results`/`contest_events` mới là nguồn sự thật (persist trước,
 * notify sau). Ném luôn ở đây sẽ biến "event to" thành "event mất".
 */
export async function publish(channel: string, payload: object): Promise<void> {
  await pool.query('SELECT pg_notify($1, $2)', [PG_CHANNEL, encode(channel, payload)])
}

/** Đăng ký nhận một kênh logic. Nhiều subscriber mỗi kênh; trả về hàm huỷ. */
export function subscribe(channel: string, fn: BusHandler): () => void {
  let set = subscribers.get(channel)
  if (!set) {
    set = new Set()
    subscribers.set(channel, set)
  }
  set.add(fn)
  return () => {
    const cur = subscribers.get(channel)
    if (!cur?.delete(fn)) return
    if (cur.size === 0) subscribers.delete(channel)
  }
}

/**
 * Đăng ký handler "mất kết nối LISTEN" — SSE dùng nó để đóng stream đang mở
 * (§4.3 đối sách (a)). Trả về hàm huỷ.
 */
export function onConnectionLost(fn: () => void): () => void {
  lossHandlers.add(fn)
  return () => {
    lossHandlers.delete(fn)
  }
}

export function busStatus(): BusStatus {
  let count = 0
  for (const set of subscribers.values()) count += set.size
  return { connected, subscribers: count, lastEventAt }
}

/** Idempotent. Không ném: nối hụt thì lùi lại và thử lại nền, app vẫn chạy. */
export async function startBus(): Promise<void> {
  if (starting) return starting
  if (!stopped && (client !== null || reconnectTimer !== null)) return
  stopped = false
  backoff = 0
  starting = openConnection().finally(() => {
    starting = null
  })
  return starting
}

/** Idempotent. Dọn sạch timer — nếu không, vitest và SIGTERM đều không thoát. */
export async function stopBus(): Promise<void> {
  stopped = true
  gen++ // event còn sót lại của connection hiện tại thành vô nghĩa
  connected = false
  pendingPing = null
  clearPing()
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  const dying = client
  client = null
  if (dying) await teardown(dying)
}

// ─────────────────────────────────────────────────────────────────── Envelope

const IDENTITY_KEYS = ['id', 'seq', 'kind', 'position', 'final', 'submissionId', 'contestId', 'userId'] as const

function encode(channel: string, payload: object): string {
  const full = JSON.stringify({ channel, payload })
  if (Buffer.byteLength(full, 'utf8') <= MAX_PAYLOAD_BYTES) return full
  return JSON.stringify({ channel, payload: identityOf(payload) })
}

/** Chỉ giữ trường định danh (scalar, ngắn) — đủ để client biết refetch cái gì. */
function identityOf(payload: object): Record<string, unknown> {
  const out: Record<string, unknown> = { truncated: true }
  const src = payload as Record<string, unknown>
  for (const key of IDENTITY_KEYS) {
    const value = src[key]
    if (typeof value === 'number' || typeof value === 'boolean') out[key] = value
    else if (typeof value === 'string' && value.length <= 256) out[key] = value
  }
  return out
}

// ─────────────────────────────────────────────────────────────────── Connection

async function openConnection(): Promise<void> {
  if (stopped || client) return
  const myGen = ++gen
  const c = new pg.Client({ connectionString: config.databaseUrl })

  const lose = (reason: string): void => {
    if (myGen !== gen) return // connection đời cũ, đã xử lý xong
    gen++ // vô hiệu hoá phần event còn lại của nó
    dropConnection(c, reason)
  }
  c.on('error', (err: Error) => lose(err.message))
  c.on('end', () => lose('connection đóng'))
  c.on('notification', (msg) => {
    if (myGen === gen) deliver(msg)
  })

  try {
    await c.connect()
    // Tên kênh là hằng của file này — không có dữ liệu ngoài nội suy vào SQL.
    await c.query(`LISTEN ${PG_CHANNEL}`)
  } catch (err) {
    lose(err instanceof Error ? err.message : String(err))
    return
  }
  if (stopped || myGen !== gen) {
    await teardown(c) // stopBus()/lose() chen ngang lúc đang bắt tay
    return
  }

  client = c
  connected = true
  backoff = 0
  pendingPing = null
  armPing()
}

function dropConnection(c: pg.Client, reason: string): void {
  const wasConnected = connected
  connected = false
  if (client === c) client = null
  pendingPing = null
  clearPing()
  void teardown(c)
  if (stopped) return

  console.warn(`[bus] mất kết nối LISTEN (${reason}) — đóng stream SSE và nối lại`)
  // Chỉ báo khi đã từng phục vụ: lần nối hụt lúc khởi động không có stream nào
  // để đóng, và stream mở lúc bus đang câm được chính SSE canh (busStatus).
  if (wasConnected) {
    for (const fn of [...lossHandlers]) {
      try {
        fn()
      } catch (err) {
        console.error('[bus] handler mất-kết-nối lỗi', err)
      }
    }
  }
  scheduleReconnect()
}

function scheduleReconnect(): void {
  if (stopped || reconnectTimer) return
  const delay = BACKOFF_MS[Math.min(backoff, BACKOFF_MS.length - 1)] ?? 30_000
  backoff++
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void openConnection()
  }, delay)
  reconnectTimer.unref() // không giữ event loop sống chỉ để chờ nối lại
}

async function teardown(c: pg.Client): Promise<void> {
  c.removeAllListeners()
  try {
    await c.end()
  } catch {
    // Connection đã chết sẵn — không có gì để đóng cho tử tế.
  }
}

function deliver(msg: pg.Notification): void {
  if (msg.channel !== PG_CHANNEL || !msg.payload) return
  let envelope: { channel?: unknown; payload?: unknown }
  try {
    envelope = JSON.parse(msg.payload) as { channel?: unknown; payload?: unknown }
  } catch {
    return // rác trên kênh chung: bỏ, không được giết bus
  }
  const channel = envelope.channel
  if (typeof channel !== 'string') return
  if (channel === PING_CHANNEL) {
    ackPing(envelope.payload)
    return
  }

  lastEventAt = new Date().toISOString()
  const set = subscribers.get(channel)
  if (!set) return
  // Copy: handler có quyền tự huỷ đăng ký ngay trong lúc nhận (SSE đóng stream).
  for (const fn of [...set]) {
    try {
      fn(envelope.payload)
    } catch (err) {
      console.error('[bus] subscriber lỗi', err)
    }
  }
}

// ──────────────────────────────────────────────────────────────────── Self-ping

function armPing(): void {
  clearPing()
  pingTimer = setInterval(() => void pingTick(), PING_MS)
  pingTimer.unref()
}

function clearPing(): void {
  if (!pingTimer) return
  clearInterval(pingTimer)
  pingTimer = null
}

async function pingTick(): Promise<void> {
  const c = client
  if (!c) return
  // Ping trước chưa quay lại sau 30 s ⇒ connection nửa-chết: không error, không
  // 'end', nhưng notification không còn tới. Xử đúng như mất kết nối.
  if (pendingPing !== null) {
    gen++
    dropConnection(c, 'self-ping không quay lại')
    return
  }
  const id = randomUUID()
  pendingPing = id
  try {
    await c.query('SELECT pg_notify($1, $2)', [
      PG_CHANNEL,
      JSON.stringify({ channel: PING_CHANNEL, payload: { id } }),
    ])
  } catch (err) {
    gen++
    dropConnection(c, `self-ping lỗi: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function ackPing(payload: unknown): void {
  const id = (payload as { id?: unknown } | null)?.id
  // Ping của process khác đi chung kênh — chỉ nhận đúng ping của mình.
  if (typeof id === 'string' && id === pendingPing) pendingPing = null
}
