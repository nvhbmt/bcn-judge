/**
 * Phiên đăng nhập (copy imath-test/server/src/auth/session.ts).
 *
 * KHÔNG JWT: token ngẫu nhiên 32 byte, DB chỉ lưu SHA-256 → lộ DB không dựng lại
 * được cookie; logout = revoke một dòng, hiệu lực tức thì.
 */
import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { config } from '@/config'
import { avatarUrl } from './discordApi'
import { db } from '@/db/pool'
import { userSessions, users } from '@/db/schema'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  role: 'admin' | 'mentor' | 'member'
  mustChangePassword: boolean
  /** Tên Discord đang gắn, `null` nếu chưa gắn — màn tài khoản hiện gắn hay bỏ gắn. */
  discordUsername: string | null
  /** URL ảnh Discord dựng sẵn ở server; `null` = dùng chữ cái đầu tên. */
  avatarUrl: string | null
  /** Công tắc "cho người khác xem bài AC của tôi" (FR-K). */
  shareSolutions: boolean
}

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest()
}

export async function createSession(
  userId: string,
  ip: string | null,
  userAgent: string | null,
): Promise<{ token: string; expiresAt: Date; maxAgeSec: number }> {
  const token = randomBytes(32).toString('base64url')
  const maxAgeSec = config.sessionTtlDays * 24 * 60 * 60
  const expiresAt = new Date(Date.now() + maxAgeSec * 1000)
  await db.insert(userSessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
    ip,
    userAgent: userAgent?.slice(0, 500) ?? null,
  })
  return { token, expiresAt, maxAgeSec }
}

export async function resolveSession(token: string | null): Promise<AuthUser | null> {
  if (!token) return null
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      mustChangePassword: users.mustChangePassword,
      discordUsername: users.discordUsername,
      discordId: users.discordId,
      discordAvatar: users.discordAvatar,
      shareSolutions: users.shareSolutions,
      disabled: users.disabled,
      deletedAt: users.deletedAt,
    })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(
      and(
        eq(userSessions.tokenHash, hashToken(token)),
        isNull(userSessions.revokedAt),
        gt(userSessions.expiresAt, sql`now()`),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row || row.disabled || row.deletedAt) return null
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role as AuthUser['role'],
    mustChangePassword: row.mustChangePassword,
    discordUsername: row.discordUsername,
    avatarUrl: avatarUrl(row.discordId, row.discordAvatar),
    shareSolutions: row.shareSolutions,
  }
}

export async function revokeSession(token: string | null): Promise<void> {
  if (!token) return
  await db
    .update(userSessions)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(userSessions.tokenHash, hashToken(token)), isNull(userSessions.revokedAt)))
}

/** FR-A3/FR-A4: đổi mật khẩu hoặc khoá tài khoản → thu hồi mọi phiên. */
export async function revokeAllSessionsOf(userId: string): Promise<void> {
  await db
    .update(userSessions)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
}
