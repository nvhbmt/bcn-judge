/** FR-H4: nhật ký hành động quản trị. Gọi từ mọi mutation của mentor/admin. */
import { db } from '../db/pool'
import { auditLog } from '../db/schema'

export async function audit(
  actorId: string | null,
  action: string,
  entityType: string | null,
  entityId: string | null,
  before: unknown,
  after: unknown,
  ip: string | null = null,
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId,
      action,
      entityType,
      entityId,
      before: (before ?? null) as never,
      after: (after ?? null) as never,
      ip,
    })
  } catch {
    // Nhật ký không bao giờ được làm hỏng nghiệp vụ chính.
  }
}
