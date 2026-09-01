/**
 * Pool container ẤM: dựng sẵn container chưa dùng để `Sandbox.create` không còn nằm
 * trên đường đi của người học.
 *
 * Đo được: tạo container tốn ~155 ms trong tổng ~620 ms của một lượt chấm bài C bốn
 * testcase — 25%, và không một mili giây nào trong đó là code của người học. Nó chỉ là
 * `docker create` + `docker start`, và hoàn toàn làm được TRƯỚC khi có bài nộp.
 *
 * ## Vì sao vẫn an toàn
 *
 * Container trong pool là container CHƯA TỪNG chạy gì: dựng xong, `sleep infinity`,
 * nằm chờ. Mỗi lượt chấm vẫn nhận một container riêng và vẫn huỷ nó sau khi xong —
 * pool không tái dùng container đã chạy code của ai. Nói cách khác pool chỉ dịch thời
 * điểm tạo về sớm hơn, không đổi vòng đời.
 *
 * ## Khoá pool phải bao gồm MỌI tuỳ chọn ảnh hưởng tới container
 *
 * Đây là chỗ dễ sai nhất và sai thì im lặng: phát nhầm một container ấm dựng với
 * `memoryMb` khác là bài được biên dịch dưới hạn mức khác hẳn hạn mức mentor đặt, mà
 * không có gì báo. Nên khoá dựng từ toàn bộ tuỳ chọn TRỪ `labels` — nhãn không đổi
 * hành vi container.
 *
 * Đổi lại, container ấm không mang được nhãn `bcnjudge.submission` (lúc dựng chưa có
 * bài nộp nào). Nhãn đó không được mã nào đọc, chỉ dùng để soi bằng `docker ps` khi có
 * sự cố — nên worker bù lại bằng cách ghi id container vào log ở đúng những lúc cần
 * truy: IE, quá giờ, hoặc namespace nhiễm độc.
 */
import { Sandbox, type SandboxCreateOptions } from './sandbox'

/** Mỗi khoá giữ đúng MỘT container chờ. Nhiều hơn là ôm tài nguyên cho một tương lai đoán mò. */
const MAX_PER_KEY = 1

/** Container ấm nằm quá lâu thì thả: một lượt Java lẻ không đáng giữ container cả ngày. */
const IDLE_TTL_MS = 10 * 60_000

interface Warm {
  sandbox: Sandbox
  readyAt: number
}

const warm = new Map<string, Warm[]>()
/** Khoá đang được dựng nền — chặn dựng chồng khi nhiều slot cùng hụt một lúc. */
const filling = new Set<string>()
let enabled = true

/**
 * `labels` bị loại khỏi khoá vì nó KHÔNG đổi hành vi container; mọi thứ còn lại đều
 * đổi, kể cả `cpusetCpus` (khác slot là khác core được pin).
 */
function keyOf(o: SandboxCreateOptions): string {
  return JSON.stringify([o.image, o.memoryMb, o.maxOutputBytes, o.cpus ?? null, o.cpusetCpus ?? null, o.pidsLimit ?? null])
}

/**
 * Container ấm chỉ mang nhãn CHỦ SỞ HỮU, không mang nhãn của bài nộp đã kích hoạt lượt
 * dựng nó: nhãn đó sẽ chỉ sang một bài nộp khác hẳn bài sau này dùng container — sai
 * còn tệ hơn thiếu, vì người trực sẽ tin nó. `bcnjudge.worker` thì đúng và là thứ bộ
 * dọn container mồ côi dựa vào.
 */
function poolLabels(o: SandboxCreateOptions): Record<string, string> {
  const owner = o.labels?.['bcnjudge.worker']
  return { 'bcnjudge.pooled': '1', ...(owner ? { 'bcnjudge.worker': owner } : {}) }
}

/** Dựng thêm một container cho khoá này, nếu còn chỗ. Không bao giờ ném. */
function fill(opts: SandboxCreateOptions): void {
  if (!enabled) return
  const key = keyOf(opts)
  if (filling.has(key)) return
  if ((warm.get(key)?.length ?? 0) >= MAX_PER_KEY) return

  filling.add(key)
  void Sandbox.create({ ...opts, labels: poolLabels(opts) })
    .then((sandbox) => {
      // Có thể đã tắt máy trong lúc dựng — đừng để lại container mồ côi.
      if (!enabled) return sandbox.destroy()
      const list = warm.get(key) ?? []
      if (list.length >= MAX_PER_KEY) return sandbox.destroy()
      list.push({ sandbox, readyAt: Date.now() })
      warm.set(key, list)
      return undefined
    })
    .catch(() => {
      /* Dựng nền hụt thì thôi: lượt sau chỉ mất đúng ~155 ms như trước khi có pool. */
    })
    .finally(() => filling.delete(key))
}

/**
 * Lấy một container để chấm. Có sẵn thì trả ngay, không thì dựng như cũ.
 *
 * Luôn nạp lại pool sau đó — kể cả khi vừa trượt — để lượt kế tiếp có hàng.
 */
export async function acquire(opts: SandboxCreateOptions): Promise<{ sandbox: Sandbox; warm: boolean }> {
  const key = keyOf(opts)
  const list = warm.get(key)
  const hit = list?.shift()
  if (hit) {
    fill(opts)
    return { sandbox: hit.sandbox, warm: true }
  }

  // Trượt: dựng đồng bộ cho lượt này, và mồi sẵn cho lượt sau.
  const sandbox = await Sandbox.create(opts)
  fill(opts)
  return { sandbox, warm: false }
}

/** Thả container ấm đã nằm quá lâu. Gọi định kỳ; không bao giờ ném. */
export async function sweepPool(now = Date.now()): Promise<number> {
  let removed = 0
  for (const [key, list] of warm) {
    const keep: Warm[] = []
    for (const w of list) {
      if (now - w.readyAt < IDLE_TTL_MS) {
        keep.push(w)
        continue
      }
      removed++
      await w.sandbox.destroy().catch(() => {})
    }
    if (keep.length === 0) warm.delete(key)
    else warm.set(key, keep)
  }
  return removed
}

/** Huỷ mọi container ấm và khoá pool lại. Bắt buộc gọi lúc tắt, nếu không là rò. */
export async function drainPool(): Promise<void> {
  enabled = false
  const all = [...warm.values()].flat()
  warm.clear()
  await Promise.all(all.map((w) => w.sandbox.destroy().catch(() => {})))
}

/** Mở lại pool sau `drainPool` — chỉ dùng trong test. */
export function resetPoolForTest(): void {
  enabled = true
  warm.clear()
  filling.clear()
}

export function poolStats(): { keys: number; ready: number } {
  let ready = 0
  for (const list of warm.values()) ready += list.length
  return { keys: warm.size, ready }
}
