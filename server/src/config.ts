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

  /** Tài khoản admin khởi tạo cho seed. */
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@bcn.local',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'bcnjudge',
} as const
