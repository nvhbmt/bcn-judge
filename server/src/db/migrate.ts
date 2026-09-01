/**
 * Chạy migration: các file drizzle/NNNN_*.sql theo thứ tự tên, mỗi file một
 * transaction, đã chạy thì bỏ qua (bảng `_migrations`).
 *
 * §9: gate `check-migrations-safe.sh` yêu cầu chỉ-additive; hai ngoại lệ viết tay
 * đã ghi danh trong design (composite FK deferrable của teams, và DROP constraint
 * khi Q17 flip).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pool } from './pool'

const MIGRATIONS_DIR = join(import.meta.dirname, '../../drizzle')

export async function migrate(log: (m: string) => void = console.log): Promise<string[]> {
  const client = await pool.connect()
  const applied: string[] = []
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    const done = new Set(
      (await client.query<{ name: string }>('SELECT name FROM _migrations')).rows.map((r) => r.name),
    )
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()

    for (const file of files) {
      if (done.has(file)) continue
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      log(`  → ${file}`)
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
        applied.push(file)
      } catch (err) {
        await client.query('ROLLBACK')
        throw new Error(`migration ${file} thất bại: ${String(err)}`)
      }
    }
  } finally {
    client.release()
  }
  return applied
}

if (import.meta.filename === process.argv[1]) {
  const applied = await migrate()
  console.log(applied.length ? `Đã áp dụng ${applied.length} migration.` : 'Không có migration mới.')
  await pool.end()
}
