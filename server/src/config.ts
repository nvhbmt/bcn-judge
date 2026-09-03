/** Cấu hình runtime — đọc env một chỗ (mẫu imath-test/server/src/config.ts). */

function int(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://bcn:bcn@localhost:5434/bcn_judge',
  port: int('PORT', 8099),
  isProd: process.env.NODE_ENV === 'production',

  /** Cookie phiên — token thô CHỈ nằm ở đây, DB chỉ giữ SHA-256 (§2.1). */
  sessionCookie: 'bcn_session',
  sessionTtlDays: int('SESSION_TTL_DAYS', 30),
  secureCookie: process.env.SECURE_COOKIE === '1',

  /** Worker (§3). */
  workerSlots: int('WORKER_SLOTS', 2),
  workerCpuset: process.env.WORKER_CPUSET ?? '',

  /**
   * Đăng nhập bằng Discord. Thiếu BẤT KỲ giá trị nào ⇒ tính năng TẮT hẳn, và nút
   * Discord không hiện ra ở màn đăng nhập.
   *
   * Tắt-thì-giấu chứ không tắt-thì-lỗi: repo anh em từng để `AI_KEY_ENC_KEY` thiếu
   * mà UI vẫn vẽ nút, bấm vào im lặng 503 — người dùng không có cách nào biết là
   * do cấu hình. Ở đây nút không hiện thì không ai bấm nhầm.
   *
   * `DISCORD_REDIRECT_URI` phải TRÙNG TỪNG KÝ TỰ với Redirect URI khai trong
   * Discord Developer Portal, kể cả dấu / cuối — Discord so khớp chuỗi nguyên văn.
   */
  discordClientId: process.env.DISCORD_CLIENT_ID ?? '',
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
  discordRedirectUri: process.env.DISCORD_REDIRECT_URI ?? '',

  /** Tài khoản admin khởi tạo cho seed. */
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@bcn.local',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'bcnjudge',
} as const
