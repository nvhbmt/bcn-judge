/** Pool Postgres + helper transaction (mẫu imath-test/server/src/db/pool.ts). */
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { config } from '../config'
import * as schema from './schema'

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
})

export const db = drizzle(pool, { schema })

export type Db = typeof db
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/** Chạy một hàm trong transaction. Mutation team BẮT BUỘC đi lối này (ADR-14:
 *  composite FK deferred chỉ được kiểm ở commit). */
export async function tx<T>(fn: (t: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (t) => fn(t))
}

export async function closePool(): Promise<void> {
  await pool.end()
}

/**
 * `execute()` của drizzle trả về QueryResult (có `.rows`) chứ không phải mảng.
 * Hai helper này trả thẳng mảng dòng đã gõ kiểu, để chỗ gọi khỏi lặp `.rows`.
 */
type AnySql = Parameters<Db['execute']>[0]

export async function q<T = Record<string, unknown>>(query: AnySql): Promise<T[]> {
  const res = (await db.execute(query)) as unknown as { rows?: T[] } | T[]
  return Array.isArray(res) ? res : (res.rows ?? [])
}

export async function qt<T = Record<string, unknown>>(t: Tx, query: AnySql): Promise<T[]> {
  const res = (await t.execute(query)) as unknown as { rows?: T[] } | T[]
  return Array.isArray(res) ? res : (res.rows ?? [])
}
