/** Seed: ngôn ngữ (FR-F7), settings mặc định (FR-H2), một tài khoản admin. */
import { sql } from 'drizzle-orm'
import { hashPassword } from '../auth/hash'
import { config } from '../config'
import { db, pool } from './pool'
import { languages, settings, users } from './schema'

const LANGUAGE_SEED = [
  {
    id: 'c11',
    name: 'C',
    versionLabel: 'C11 · GCC 12',
    image: 'bcnjudge-runner-gcc:14',
    sourceFilename: 'main.c',
    compileArgv: ['gcc', '-std=c11', '-O2', '-pipe', '-static', '-s', '-o', '/w/prog', 'main.c', '-lm'],
    runArgv: ['/w/prog'],
    timeFactor: '1',
    memoryExtraMb: 0,
    cmMode: 'c',
    enabled: true,
    position: 1,
  },
  {
    id: 'cpp17',
    name: 'C++',
    versionLabel: 'C++17 · GCC 12',
    image: 'bcnjudge-runner-gcc:14',
    sourceFilename: 'main.cpp',
    compileArgv: ['g++', '-std=c++17', '-O2', '-pipe', '-static', '-s', '-o', '/w/prog', 'main.cpp'],
    runArgv: ['/w/prog'],
    timeFactor: '1',
    memoryExtraMb: 0,
    cmMode: 'cpp',
    enabled: true,
    position: 2,
  },
  {
    id: 'python3',
    name: 'Python',
    versionLabel: '3.12',
    image: 'bcnjudge-runner-python:3.12',
    sourceFilename: 'main.py',
    compileArgv: ['python3', '-m', 'py_compile', 'main.py'],
    runArgv: ['python3', 'main.py'],
    timeFactor: '3',
    memoryExtraMb: 64,
    cmMode: 'python',
    enabled: true,
    position: 3,
  },
  // S — build sẵn nhưng tắt (FR-F7).
  {
    id: 'java17',
    name: 'Java',
    versionLabel: '17',
    image: 'bcnjudge-runner-openjdk:17',
    sourceFilename: 'Main.java',
    compileArgv: ['javac', '-proc:none', '-d', '/w', 'Main.java'],
    runArgv: ['java', '-Xmx{memory_mb}m', '-cp', '/w', 'Main'],
    timeFactor: '2',
    memoryExtraMb: 256,
    cmMode: 'java',
    enabled: false,
    position: 4,
  },
  {
    id: 'node20',
    name: 'JavaScript',
    versionLabel: 'Node 20',
    image: 'bcnjudge-runner-node:20',
    sourceFilename: 'main.js',
    compileArgv: null,
    runArgv: ['node', 'main.js'],
    timeFactor: '2',
    memoryExtraMb: 128,
    cmMode: 'javascript',
    enabled: false,
    position: 5,
  },
]

/** FR-H2 v0.5 + FR-F5 — mọi mặc định đều cấu hình được qua trang admin. */
const SETTINGS_SEED: Record<string, unknown> = {
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
  banner: null,
}

export async function seed(log: (m: string) => void = console.log): Promise<void> {
  for (const lang of LANGUAGE_SEED) {
    await db
      .insert(languages)
      .values(lang as never)
      .onConflictDoUpdate({ target: languages.id, set: { image: lang.image, runArgv: lang.runArgv as never } })
  }
  log(`  ngôn ngữ: ${LANGUAGE_SEED.length} dòng`)

  for (const [key, value] of Object.entries(SETTINGS_SEED)) {
    // Cột jsonb NOT NULL: `null` của JS thành SQL NULL, phải ép thành JSON null.
    const jsonValue = value === null ? sql`'null'::jsonb` : (value as never)
    await db.insert(settings).values({ key, value: jsonValue }).onConflictDoNothing()
  }
  log(`  settings: ${Object.keys(SETTINGS_SEED).length} khoá`)

  const { hash, algo } = await hashPassword(config.seedAdminPassword)
  const [admin] = await db
    .insert(users)
    .values({
      email: config.seedAdminEmail,
      displayName: 'Quản trị viên',
      role: 'admin',
      passwordHash: hash,
      hashAlgo: algo,
      mustChangePassword: true,
    })
    .onConflictDoNothing()
    .returning({ id: users.id })
  log(admin ? `  admin: ${config.seedAdminEmail} / ${config.seedAdminPassword}` : '  admin: đã có, bỏ qua')
}

if (import.meta.filename === process.argv[1]) {
  await seed()
  await pool.end()
}
