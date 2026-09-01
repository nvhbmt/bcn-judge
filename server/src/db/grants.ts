/**
 * Ba role Postgres (ADR-5): API, worker và migrate có quyền khác nhau, để một cú
 * chiếm quyền ở tầng SQL không tự động thành toàn quyền.
 *
 * Nói thẳng phạm vi (ADR-5 sửa vòng 2): ba role này CHỈ chứa được cú chiếm ở tầng
 * SQL. Một RCE trong worker vẫn cầm quyền nói chuyện với Docker daemon; đường chứa
 * thật (rootless / VPS judge riêng) là việc post-v1.
 *
 * Idempotent — chạy lại sau MỌI migration (§9), vì bảng mới sinh ra không có grant
 * thì chỉ nổ ở runtime thành 500.
 */
import { pool } from './pool'

export const ROLES = {
  app: 'bcn_app',
  worker: 'bcn_worker',
  migrate: 'bcn_migrate',
} as const

/** Bảng worker được đụng vào — mọi thứ khác nằm ngoài tầm với của nó. */
const WORKER_READ = [
  'submissions',
  'submission_results',
  'testcases',
  'problems',
  'languages',
  'settings',
  'contests',
  'contest_problems',
  'rejudge_queue',
  'workers',
]
const WORKER_WRITE = ['submissions', 'submission_results', 'workers', 'rejudge_queue', 'contest_events', 'submission_score_audit']

export async function applyGrants(log: (m: string) => void = console.log): Promise<boolean> {
  const client = await pool.connect()
  try {
    const { rows } = await client.query<{ superuser: boolean }>(
      'SELECT usesuper AS superuser FROM pg_user WHERE usename = current_user',
    )
    if (!rows[0]?.superuser) {
      log('  bỏ qua: user hiện tại không phải superuser')
      return false
    }

    for (const role of Object.values(ROLES)) {
      await client.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
          CREATE ROLE ${role} NOLOGIN;
        END IF;
      END $$;`)
    }

    await client.query(`GRANT USAGE ON SCHEMA public TO ${ROLES.app}, ${ROLES.worker}, ${ROLES.migrate}`)

    // API: đọc/ghi nghiệp vụ, KHÔNG có DDL.
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ROLES.app}`)
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ROLES.app}`)

    // Worker: chỉ những bảng nó thật sự cần.
    await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${ROLES.worker}`)
    for (const table of WORKER_READ) {
      await client.query(`GRANT SELECT ON ${table} TO ${ROLES.worker}`)
    }
    for (const table of WORKER_WRITE) {
      await client.query(`GRANT INSERT, UPDATE ON ${table} TO ${ROLES.worker}`)
    }
    // Việc dọn dẹp mỗi giờ + nhả claim rejudge cần DELETE (sửa vòng 2 của design).
    await client.query(`GRANT DELETE ON submissions, contest_events, rejudge_queue TO ${ROLES.worker}`)
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ROLES.worker}`)

    // Migrate: toàn quyền DDL.
    await client.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO ${ROLES.migrate}`)
    await client.query(`GRANT CREATE ON SCHEMA public TO ${ROLES.migrate}`)

    // Bảng sinh sau này cũng có grant sẵn.
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${ROLES.app}`,
    )
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${ROLES.app}, ${ROLES.worker}`)

    log(`  grants: ${Object.values(ROLES).join(', ')}`)
    return true
  } finally {
    client.release()
  }
}

/** Smoke test trước khi flip blue/green (§9): worker KHÔNG được chạm bảng người dùng. */
export async function checkWorkerCannotTouchUsers(): Promise<{ ok: boolean; detail: string }> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL ROLE ${ROLES.worker}`)
    try {
      await client.query("INSERT INTO users (email, display_name, role) VALUES ('x@x.x', 'x', 'admin')")
      return { ok: false, detail: 'worker chèn được vào users — grants sai' }
    } catch (err) {
      const message = String(err)
      const denied = message.includes('permission denied')
      return { ok: denied, detail: denied ? 'worker bị từ chối đúng như mong đợi' : message.slice(0, 200) }
    } finally {
      await client.query('ROLLBACK')
    }
  } finally {
    client.release()
  }
}

if (import.meta.filename === process.argv[1]) {
  const applied = await applyGrants()
  if (applied) console.log(JSON.stringify(await checkWorkerCannotTouchUsers()))
  await pool.end()
}
