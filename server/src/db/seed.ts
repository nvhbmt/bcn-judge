/** Seed: ngôn ngữ (FR-F7), settings mặc định (FR-H2), một tài khoản admin. */
import { sql } from 'drizzle-orm'
import { hashPassword } from '@/auth/hash'
import { config } from '@/config'
import { DEFAULTS } from '@/lib/settings'
import { db, pool } from './pool'
import { languages, settings, users } from './schema'

const LANGUAGE_SEED = [
  {
    id: 'c11',
    name: 'C',
    versionLabel: 'C11 · GCC 12',
    image: 'bcnjudge-runner-gcc:14',
    sourceFilename: 'main.c',
    functionSourceFilename: 'solution.c',
    compileArgvFunction: null,
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
    functionSourceFilename: 'solution.cpp',
    compileArgvFunction: null,
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
    functionSourceFilename: 'solution.py',
    compileArgvFunction: ['python3', '-m', 'py_compile', 'solution.py', 'main.py'],
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
    functionSourceFilename: 'Solution.java',
    compileArgvFunction: ['javac', '-proc:none', '-d', '/w', 'Main.java', 'Solution.java'],
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
    functionSourceFilename: 'solution.js',
    compileArgvFunction: ['node', '--check', 'solution.js'],
    compileArgv: null,
    runArgv: ['node', 'main.js'],
    timeFactor: '2',
    memoryExtraMb: 128,
    cmMode: 'javascript',
    enabled: false,
    position: 5,
  },
]

/**
 * FR-H2 v0.5 + FR-F5 — mọi mặc định đều cấu hình được qua trang admin.
 *
 * Lấy THẲNG từ `DEFAULTS` của lib/settings, không chép lại: hai bản chép sẽ trôi khỏi
 * nhau, mà hướng trôi lại lặng lẽ nhất có thể — DB seed ghi giá trị cũ thành một dòng
 * thật, và dòng thật luôn thắng mặc định.
 *
 * Khoá `banner: null` cũ đã bỏ: nó không nằm trong `JudgeSettings` nên `getSettings()`
 * không bao giờ trả về, `PATCH /settings` bỏ qua key lạ nên cũng không sửa được, và
 * không có chỗ nào đọc. Một dòng DB không ai đọc được lẫn ghi được.
 */
const SETTINGS_SEED: Record<string, unknown> = { ...DEFAULTS }

export async function seed(log: (m: string) => void = console.log): Promise<void> {
  for (const lang of LANGUAGE_SEED) {
    await db
      .insert(languages)
      .values(lang as never)
      // Cập nhật cả cấu hình dạng function, nếu không DB đã seed từ trước sẽ mãi
      // thiếu và mọi bài function trên đó thành IE.
      .onConflictDoUpdate({
        target: languages.id,
        set: {
          image: lang.image,
          runArgv: lang.runArgv as never,
          functionSourceFilename: lang.functionSourceFilename,
          compileArgvFunction: lang.compileArgvFunction as never,
        },
      })
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
