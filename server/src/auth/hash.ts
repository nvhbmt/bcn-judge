/** Băm mật khẩu — argon2id (copy imath, bỏ nhánh firebase-scrypt legacy). */
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2'

const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const

export async function hashPassword(plain: string): Promise<{ hash: string; algo: 'argon2id' }> {
  return { hash: await argonHash(plain, OPTIONS), algo: 'argon2id' }
}

export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (!hash) return false
  try {
    return await argonVerify(hash, plain)
  } catch {
    return false
  }
}

/** Mật khẩu sinh sẵn cho FR-A2/FR-A3 (admin cấp tài khoản / đặt lại). */
export function generatePassword(length = 10): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}
