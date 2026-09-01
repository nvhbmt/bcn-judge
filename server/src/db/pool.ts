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
