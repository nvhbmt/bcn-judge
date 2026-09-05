/**
 * Đo năng lực chấm bài để suy ra cấu hình VPS.
 *
 *   cd server && DATABASE_URL=... node --import tsx src/testing/stress.ts --slots 4 --count 60
 *
 * Vì sao đẩy thẳng vào hàng đợi thay vì gọi HTTP: nút cổ chai của hệ thống là
 * worker + Docker, không phải API. Đi qua HTTP còn vướng hai giới hạn có chủ đích
 * (6 lần nộp/phút mỗi người, 10 lần đăng nhập/phút mỗi IP) — chúng đúng đắn nhưng
 * làm méo phép đo năng lực chấm. Năng lực đọc của API đo riêng bằng stress-api.ts.
 *
 * Con số CHUYỂN được sang VPS: CPU-giây và RAM cho mỗi bài nộp. Con số KHÔNG
 * chuyển được: độ trễ tuyệt đối (máy dev là OrbStack trên Apple Silicon).
 */
import { sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { pool, q } from '@/db/pool'

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

const COUNT = Number(arg('count', '60'))
const LANG = arg('lang', 'c11')
const TESTCASES = Number(arg('testcases', '10'))
const LABEL = arg('label', '')

const SOURCE: Record<string, string> = {
  /**
   * Ăn 200 MB và CHẠM THẬT vào từng trang — đo trường hợp xấu nhất về bộ nhớ.
   * `volatile` là bắt buộc: bản đầu dùng malloc+memset thường và GCC -O2 xoá sạch
   * cả cụm (cấp phát không quan sát được thì bị loại), RSS đo ra chỉ 0,5 MB và
   * phép đo hoá ra vô nghĩa.
   */
  'c11-ram': [
    '#include <stdlib.h>',
    '#include <stdio.h>',
    'int main(void){',
    '  long long a,b; if (scanf("%lld %lld",&a,&b)!=2) return 1;',
    '  size_t n = 200u<<20;',
    '  volatile char *p = malloc(n);',
    '  if (!p) return 2;',
    '  for (size_t i = 0; i < n; i += 4096) p[i] = 1;',
    '  long long s = 0;',
    '  for (size_t i = 0; i < n; i += 4096) s += p[i];',
    '  printf("%lld\\n", a + b + (s > 0 ? 0 : 1));',
    '  return 0;',
    '}',
  ].join('\n') + '\n',
  c11: '#include <stdio.h>\nint main(void){long long a,b;if(scanf("%lld %lld",&a,&b)!=2)return 1;printf("%lld\\n",a+b);return 0;}\n',
  cpp17: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){long long a,b;if(!(cin>>a>>b))return 1;cout<<a+b<<"\\n";return 0;}\n',
  python3: 'import sys\nd = sys.stdin.read().split()\nprint(int(d[0]) + int(d[1]))\n',
  java17: 'import java.util.Scanner;\npublic class Main { public static void main(String[] x) { Scanner s = new Scanner(System.in); System.out.println(s.nextLong() + s.nextLong()); } }\n',
}

async function setup(): Promise<{ problemId: string; userIds: string[] }> {
  const [admin] = await q<{ id: string }>(sql`SELECT id FROM users WHERE role = 'admin' LIMIT 1`)
  if (!admin) throw new Error('chưa seed admin — chạy npm run db:seed trước')

  const [problem] = await q<{ id: string }>(sql`
    INSERT INTO problems (title, statement_md, time_limit_ms, memory_limit_mb, created_by, testcase_rev)
    VALUES (${`Stress ${Date.now()}`}, 'Tổng hai số', 1000, 256, ${admin.id}, 1)
    RETURNING id
  `)
  const problemId = problem!.id

  for (let i = 1; i <= TESTCASES; i++) {
    const input = Buffer.from(`${i} ${i * 2}\n`)
    const expected = Buffer.from(`${i * 3}\n`)
    await q(sql`
      INSERT INTO testcases (problem_id, position, kind, weight, input, expected,
                             input_bytes, expected_bytes, input_sha256)
      VALUES (${problemId}, ${i}, ${i <= 2 ? 'sample' : 'hidden'}, 1, ${input}, ${expected},
              ${input.length}, ${expected.length}, ${createHash('sha256').update(input).digest()})
    `)
  }

  // Nhiều người khác nhau: luật §4.2 không cho một người giữ 2 slot cùng kind, nên
  // dồn hết vào một tài khoản sẽ đo ra năng lực của luật đó chứ không phải của máy.
  const userIds: string[] = []
  const existing = await q<{ id: string }>(sql`SELECT id FROM users WHERE role = 'member' LIMIT ${COUNT}`)
  userIds.push(...existing.map((u) => u.id))
  for (let i = userIds.length; i < COUNT; i++) {
    const [u] = await q<{ id: string }>(sql`
      INSERT INTO users (email, display_name, role, must_change_password)
      VALUES (${`stress-${Date.now()}-${i}@test.local`}, ${`Stress ${i}`}, 'member', false)
      RETURNING id
    `)
    userIds.push(u!.id)
  }
  return { problemId, userIds }
}

async function main(): Promise<void> {
  const source = SOURCE[LANG]
  if (!source) throw new Error(`chưa có mã mẫu cho ngôn ngữ ${LANG}`)
  // Biến thể '<lang>-ram' dùng chung ngôn ngữ gốc, chỉ khác mã nguồn.
  const languageId = LANG.replace(/-ram$/, '')

  const { problemId, userIds } = await setup()

  // Nạp cả loạt cùng lúc — mô phỏng phút đầu của contest, lúc tải cao nhất.
  const enqueuedAt = Date.now()
  for (let i = 0; i < COUNT; i++) {
    await q(sql`
      INSERT INTO submissions (kind, user_id, problem_id, language_id, source, source_bytes, status)
      VALUES ('submit', ${userIds[i % userIds.length]}, ${problemId}, ${languageId},
              ${source}, ${Buffer.byteLength(source)}, 'pending')
    `)
  }
  await q(sql`SELECT pg_notify('submissions', '')`)
  console.log(`đã xếp ${COUNT} bài (${LANG}, ${TESTCASES} testcase)${LABEL ? ` — ${LABEL}` : ''}, đang đợi worker…`)

  let lastDone = 0
  const deadline = Date.now() + 20 * 60_000
  for (;;) {
    const [row] = await q<{ done: number; running: number; pending: number }>(sql`
      SELECT count(*) FILTER (WHERE status = 'done')::int AS done,
             count(*) FILTER (WHERE status = 'running')::int AS running,
             count(*) FILTER (WHERE status = 'pending')::int AS pending
      FROM submissions WHERE problem_id = ${problemId}
    `)
    if (row!.done !== lastDone) {
      lastDone = row!.done
      process.stdout.write(`\r  xong ${row!.done}/${COUNT} · đang chấm ${row!.running} · chờ ${row!.pending}   `)
    }
    if (row!.done >= COUNT) break
    if (Date.now() > deadline) throw new Error('quá 20 phút mà hàng đợi chưa cạn')
    await new Promise((r) => setTimeout(r, 250))
  }
  const wallMs = Date.now() - enqueuedAt
  process.stdout.write('\n')

  const [stat] = await q<{
    ac: number; ie: number; judge_avg: number; judge_p95: number
    queued_avg: number; queued_max: number; mem_avg: number; mem_max: number
  }>(sql`
    SELECT count(*) FILTER (WHERE verdict = 'AC')::int AS ac,
           count(*) FILTER (WHERE verdict = 'IE')::int AS ie,
           round(avg(judge_ms))::int AS judge_avg,
           round(percentile_cont(0.95) WITHIN GROUP (ORDER BY judge_ms))::int AS judge_p95,
           round(avg(queued_ms))::int AS queued_avg,
           max(queued_ms)::int AS queued_max,
           round(avg(memory_kb_max))::int AS mem_avg,
           max(memory_kb_max)::int AS mem_max
    FROM submissions WHERE problem_id = ${problemId}
  `)

  const perMin = (COUNT / (wallMs / 1000)) * 60
  console.log(`
──────────────── KẾT QUẢ ────────────────
Ngôn ngữ            : ${LANG}, ${TESTCASES} testcase/bài
Số bài              : ${COUNT}   (AC ${stat!.ac}, IE ${stat!.ie})
Tổng thời gian      : ${(wallMs / 1000).toFixed(1)} s
Thông lượng         : ${perMin.toFixed(1)} bài/phút
Chấm mỗi bài (judge): trung bình ${stat!.judge_avg} ms · p95 ${stat!.judge_p95} ms
Chờ trong hàng đợi  : trung bình ${(stat!.queued_avg / 1000).toFixed(1)} s · lâu nhất ${(stat!.queued_max / 1000).toFixed(1)} s
RAM tiến trình      : trung bình ${Math.round(stat!.mem_avg / 1024)} MB · đỉnh ${Math.round(stat!.mem_max / 1024)} MB
`)

  await q(sql`DELETE FROM submissions WHERE problem_id = ${problemId}`)
  await q(sql`DELETE FROM testcases WHERE problem_id = ${problemId}`)
  await q(sql`DELETE FROM problems WHERE id = ${problemId}`)
}

await main()
await pool.end()
