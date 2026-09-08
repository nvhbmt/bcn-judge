/** Đọc bảng `settings` (FR-H2) với cache ngắn — mọi giới hạn đều cấu hình được. */
import { db } from '@/db/pool'
import { settings } from '@/db/schema'

export interface JudgeSettings {
  default_time_limit_ms: number
  default_memory_limit_mb: number
  max_source_bytes: number
  max_custom_input_bytes: number
  submissions_per_minute: number
  runs_per_minute: number
  max_pending_submissions_per_user: number
  max_output_bytes: number
  compile_time_limit_ms: number
  compile_memory_mb: number
  max_testcase_file_bytes: number
  max_testcases_total_bytes_per_problem: number
  max_zip_bytes: number
  tle_skip_threshold: number
  judge_paused: boolean
  /**
   * FR-H5 — banner thông báo toàn hệ thống ("bảo trì 22:00"). Chuỗi rỗng = không có
   * thông báo; đây là khoá cài đặt DUY NHẤT mang chữ, mọi khoá còn lại là số hoặc cờ.
   */
  announcement: string
  /**
   * Bộ quét Discord (auth/discordSweep.ts) mặc định chỉ khoá tài khoản do cổng guild
   * sinh ra (không mật khẩu). Bật cờ này thì tài khoản admin cấp tay có gắn Discord
   * cũng bị khoá khi rời server — mentor rời server là mất luôn đường vào, nên tắt sẵn.
   */
  discord_kick_locks_password_accounts: boolean
}

/**
 * Mặc định khi bảng `settings` chưa có dòng tương ứng — và cũng là thứ `db:seed` ghi
 * vào DB. MỘT nguồn cho cả hai: trước đây seed.ts chép lại nguyên 15 giá trị này, nên
 * sửa mặc định ở đây mà quên sửa bên kia thì DB mới seed vẫn mang giá trị CŨ — và dòng
 * đã tồn tại thì luôn thắng mặc định, nên sai lặng lẽ và vĩnh viễn.
 */
export const DEFAULTS: JudgeSettings = {
  default_time_limit_ms: 1000,
  default_memory_limit_mb: 256,
  max_source_bytes: 65_536,
  max_custom_input_bytes: 65_536,
  submissions_per_minute: 6,
  runs_per_minute: 6,
  max_pending_submissions_per_user: 3,
  max_output_bytes: 8_388_608,
  compile_time_limit_ms: 15_000,
  compile_memory_mb: 1024,
  max_testcase_file_bytes: 10_485_760,
  max_testcases_total_bytes_per_problem: 134_217_728,
  max_zip_bytes: 67_108_864,
  tle_skip_threshold: 0,
  judge_paused: false,
  announcement: '',
  discord_kick_locks_password_accounts: false,
}

let cache: { at: number; value: JudgeSettings } | null = null
const TTL_MS = 5_000

export async function getSettings(): Promise<JudgeSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value
  const rows = await db.select().from(settings)
  const merged = { ...DEFAULTS }
  for (const row of rows) {
    if (row.key in merged && row.value !== null) {
      ;(merged as Record<string, unknown>)[row.key] = row.value
    }
  }
  cache = { at: Date.now(), value: merged }
  return merged
}

/**
 * Vứt cache — chỉ dùng cho test.
 *
 * `resetDb()` TRUNCATE bảng `settings` rồi seed lại, nhưng cache sống ở biến module
 * nên nó không biết gì về chuyện đó: test sau đọc trúng giá trị test trước vừa đặt,
 * và hỏng theo THỨ TỰ CHẠY — loại lỗi chỉ hiện khi ai đó thêm một test ở giữa.
 */
export function resetSettingsCache(): void {
  cache = null
}

export async function setSetting(key: string, value: unknown, actorId: string | null): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value: value as never, updatedBy: actorId })
    .onConflictDoUpdate({ target: settings.key, set: { value: value as never, updatedBy: actorId } })
  cache = null
}
