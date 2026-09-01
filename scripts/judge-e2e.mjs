#!/usr/bin/env node
/**
 * Kiểm luồng CHẤM BÀI end-to-end qua HTTP, với API + worker + Docker chạy thật.
 *
 * Khác `smoke.mjs`: smoke đi một lượt mỏng qua toàn hệ thống để chắc mọi thứ có
 * nối với nhau. File này chỉ soi luồng chấm, nhưng soi tới đáy — mọi verdict sinh
 * từ hành vi thật của chương trình, điểm từng phần, chống rò testcase ẩn, chạy
 * thử, contest, chấm lại, và hàng đợi dưới tải.
 *
 * Vì sao cần cả ba tầng: test tích hợp gọi `app.request` in-process, test sandbox
 * gọi thẳng driver Docker. Không cái nào chứng minh được rằng **worker là một tiến
 * trình riêng** nhặt đúng việc từ hàng đợi Postgres rồi ghi kết quả về đúng chỗ mà
 * serializer member đọc.
 *
 *   BASE=http://localhost:8299 node scripts/judge-e2e.mjs
 *
 * Cần: API + worker đang chạy, runner image đã build, Postgres còn sống, và một
 * database còn trống (script tạo tài khoản/khoá/bài mới, không dọn sau khi chạy).
 */
const BASE = process.env.BASE ?? 'http://localhost:8299'
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@bcn.local'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'bcnjudge'
const STAMP = Date.now()
/**
 * Hai canary, chỉ nằm trong testcase ẩn. Byte nào member nhận được mà chứa chúng
 * là một lỗ rò NFR-2.
 *
 * Cần tới hai vì hai vế rò theo hai đường khác nhau, và vế expected có ràng buộc
 * riêng: bài phải validate được bằng lời giải mẫu thì mới xuất bản nổi (FR-D6).
 * Nên canary của vế expected phải là thứ lời giải mẫu THẬT SỰ in ra — tức một con
 * số. Canary của vế input thì là rác nằm sau hai số, `scanf` bỏ qua.
 */
const CANARY = `CANARY${STAMP}KHONGDUOCLO`
const CANARY_NUM = String(9_000_000_000_000 + (STAMP % 900_000_000))

let passed = 0
const failures = []

function check(label, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`)
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function makeClient() {
  let cookie = ''
  return async function call(path, { method = 'GET', body } = {}) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'x-api-response-version': '2',
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0]
    let json = null
    try {
      json = await res.json()
    } catch {
      /* không phải JSON */
    }
    return { status: res.status, body: json }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitFor(fn, timeoutMs, what = 'điều kiện') {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await fn()
    if (value) return value
    await sleep(400)
  }
  throw new Error(`hết ${Math.round(timeoutMs / 1000)} s mà chưa đạt: ${what}`)
}

// ── Chương trình mẫu ────────────────────────────────────────────────────────
// Bài dùng chung: đọc a và b, in a + b.

const SRC = {
  c11: {
    ac: '#include <stdio.h>\nint main(void){long long a,b;if(scanf("%lld %lld",&a,&b)!=2)return 1;printf("%lld\\n",a+b);return 0;}\n',
    wa: '#include <stdio.h>\nint main(void){long long a,b;scanf("%lld %lld",&a,&b);printf("%lld\\n",a-b);return 0;}\n',
    // Vòng lặp vô hạn có việc thật bên trong, để trình tối ưu không xoá mất.
    tle: '#include <stdio.h>\nint main(void){volatile long long s=0;for(;;)s++;printf("%lld\\n",s);return 0;}\n',
    // Chạm thật vào từng trang nhớ; chỉ malloc thì kernel cấp phát lười, không tốn RAM.
    mle: '#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\nint main(void){size_t n=64u<<20;for(int i=0;i<16;i++){char*p=malloc(n);if(!p)return 2;memset(p,i+1,n);}printf("xong\\n");return 0;}\n',
    re: '#include <stdio.h>\nint main(void){int*p=0;*p=1;printf("%d\\n",*p);return 0;}\n',
    ce: '#include <stdio.h>\nint main(void){int a, b\nscanf("%d %d",&a,&b);return 0;}\n',
    /** Kẹp tổng về 0 khi âm → đúng 2/4 testcase của bộ dưới. */
    partial: '#include <stdio.h>\nint main(void){long long a,b;scanf("%lld %lld",&a,&b);long long s=a+b;printf("%lld\\n",s>0?s:0);return 0;}\n',
  },
  cpp17: { ac: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){long long a,b;if(!(cin>>a>>b))return 1;cout<<a+b<<"\\n";return 0;}\n' },
  python3: { ac: 'import sys\nd = sys.stdin.read().split()\nprint(int(d[0]) + int(d[1]))\n' },
  java17: { ac: 'import java.util.Scanner;\npublic class Main { public static void main(String[] a) { Scanner s = new Scanner(System.in); System.out.println(s.nextLong() + s.nextLong()); } }\n' },
  node20: { ac: 'const d = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/);\nconsole.log((BigInt(d[0]) + BigInt(d[1])).toString());\n' },
}

/**
 * Bài dạng function (kiểu LeetCode): người học chỉ viết hàm `twoSum`, harness của
 * mentor đọc stdin rồi gọi hàm đó. Sau khi ghép, chương trình vẫn stdin → stdout.
 */
const FN = {
  harness: {
    c11: '#include <stdio.h>\n#include <stdlib.h>\n#include "solution.c"\nint main(void){int n;if(scanf("%d",&n)!=1)return 1;int*a=malloc((size_t)n*sizeof(int));for(int i=0;i<n;i++)scanf("%d",&a[i]);int t;scanf("%d",&t);int rn=0;int*r=twoSum(a,n,t,&rn);for(int i=0;i<rn;i++)printf("%d%s",r[i],i+1<rn?" ":"");printf("\\n");return 0;}\n',
    python3: 'import sys\nfrom solution import Solution\nd = sys.stdin.read().split()\nn = int(d[0])\nnums = [int(x) for x in d[1:1+n]]\nprint(" ".join(str(x) for x in Solution().twoSum(nums, int(d[1+n]))))\n',
  },
  ac: {
    c11: 'int *twoSum(int *nums,int n,int target,int *returnSize){static int r[2];for(int i=0;i<n;i++)for(int j=i+1;j<n;j++)if(nums[i]+nums[j]==target){r[0]=i;r[1]=j;*returnSize=2;return r;}*returnSize=0;return r;}\n',
    python3: 'class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for i, x in enumerate(nums):\n            if target - x in seen:\n                return [seen[target - x], i]\n            seen[x] = i\n        return []\n',
  },
  wa: {
    c11: 'int *twoSum(int *nums,int n,int target,int *returnSize){static int r[2];for(int i=0;i<n;i++)for(int j=i+1;j<n;j++)if(nums[i]+nums[j]==target){r[0]=j;r[1]=i;*returnSize=2;return r;}*returnSize=0;return r;}\n',
  },
  ce: { python3: 'class Solution:\n    def twoSum(self, nums, target)\n        return []\n' },
  testcases: [
    { input: '4\n2 7 11 15\n9\n', expected: '0 1\n', kind: 'sample' },
    { input: '3\n3 2 4\n6\n', expected: '1 2\n', kind: 'hidden' },
    { input: '2\n3 3\n6\n', expected: '0 1\n', kind: 'hidden' },
  ],
}

/**
 * 4 testcase: 1 mẫu + 3 ẩn. Hai test có tổng ≤ 0, nên `partial` đúng đúng 2/4.
 * KHÔNG nhét canary vào đây: canary là rác nằm ngoài định dạng, chương trình nào
 * đọc hết stdin (Python, Node) sẽ vỡ và ta đo nhầm lỗi của chính bài kiểm.
 */
const TESTCASES = [
  { input: '1 2\n', expected: '3\n', kind: 'sample' },
  { input: '10 20\n', expected: '30\n', kind: 'hidden' },
  { input: '-5 -7\n', expected: '-12\n', kind: 'hidden' },
  { input: '-1 -1\n', expected: '-2\n', kind: 'hidden' },
]

/** Bài riêng để soi rò rỉ: canary ở CẢ input ẩn lẫn expected ẩn. */
const LEAK_TESTCASES = [
  { input: '1 2\n', expected: '3\n', kind: 'sample' },
  { input: `3 4\n${CANARY}\n`, expected: '7\n', kind: 'hidden' },
  { input: `${BigInt(CANARY_NUM) - 1n} 1\n`, expected: `${CANARY_NUM}\n`, kind: 'hidden' },
]

async function main() {
  console.log(`Kiểm luồng chấm bài → ${BASE}\n`)

  // ── 1. Chuẩn bị ───────────────────────────────────────────────────────────
  console.log('1. Chuẩn bị')
  const admin = makeClient()
  let login = await admin('/auth/login', { method: 'POST', body: { emailOrUsername: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  if (login.status !== 200) {
    login = await admin('/auth/login', { method: 'POST', body: { emailOrUsername: ADMIN_EMAIL, password: `${ADMIN_PASSWORD}-e2e` } })
  }
  check('admin đăng nhập', login.status === 200, JSON.stringify(login.body))
  if (login.status !== 200) return finish()
  if (login.body.data.mustChangePassword) {
    await admin('/auth/change-password', { method: 'POST', body: { currentPassword: ADMIN_PASSWORD, newPassword: `${ADMIN_PASSWORD}-e2e` } })
  }

  const health = await admin('/healthz')
  check('API và DB còn sống', (health.body?.data ?? health.body)?.status === 'ok', JSON.stringify(health.body))

  const judge = await admin('/api/admin/judge')
  const workers = judge.body?.data?.workers ?? []
  check('có worker đang sống', workers.some((w) => w.alive),
    'chưa bật worker? cd server && node --import tsx src/worker.ts')
  if (!workers.some((w) => w.alive)) return finish()

  const course = await admin('/api/admin/courses', { method: 'POST', body: { code: `judge${STAMP}`, name: 'Khoá kiểm luồng chấm', status: 'open' } })
  const courseId = course.body?.data?.id
  check('tạo khoá học', course.status === 201, JSON.stringify(course.body))

  /**
   * POOL CỐ ĐỊNH 6 tài khoản, không phải mỗi kịch bản một tài khoản.
   * `/auth/login` chặn 10 lần đăng nhập mỗi IP (auth/routes.ts:22) — chống dò mật
   * khẩu, hoàn toàn đúng, nên bài kiểm phải sống chung với nó chứ không nới ra.
   * Người cuối CỐ Ý không ghi danh, để đóng vai người ngoài khoá ở mục 12.
   */
  const POOL = 6
  const pool = []
  for (let i = 0; i < POOL; i++) {
    const email = `judge-m${i}-${STAMP}@test.local`
    const created = await admin('/api/admin/users', { method: 'POST', body: { email, displayName: `E2E m${i}`, role: 'member' } })
    const pw = created.body?.data?.initialPassword
    if (i < POOL - 1) await admin(`/api/admin/courses/${courseId}/enrollments`, { method: 'POST', body: { emails: [email] } })
    const cli = makeClient()
    const lg = await cli('/auth/login', { method: 'POST', body: { emailOrUsername: email, password: pw } })
    if (lg.status !== 200) {
      check(`đăng nhập được tài khoản m${i}`, false, JSON.stringify(lg.body))
      return finish()
    }
    await cli('/auth/change-password', { method: 'POST', body: { currentPassword: pw, newPassword: `${pw}-x1` } })
    pool.push(cli)
  }
  check(`tạo ${POOL} tài khoản member (${POOL - 1} ghi danh, 1 ngoài khoá)`, pool.length === POOL)

  let cursor = 0
  /** Chia lượt cho pool: giới hạn 6 lần nộp mỗi phút là tính theo NGƯỜI. */
  const nextMember = () => pool[cursor++ % (POOL - 1)]
  const outsider = pool[POOL - 1]

  // ── 2. Bài tập, testcase, xuất bản ────────────────────────────────────────
  console.log('\n2. Bài tập, testcase, xuất bản')

  async function makeProblem(title, testcases) {
    const p = await admin('/api/mentor/problems', {
      method: 'POST',
      body: {
        title,
        statementMd: 'Cho **a** và **b**, in ra tổng.',
        timeLimitMs: 1000,
        memoryLimitMb: 256,
        solutionLanguageId: 'c11',
        solutionSource: SRC.c11.ac,
      },
    })
    const id = p.body?.data?.id
    const tc = await admin(`/api/mentor/problems/${id}/testcases`, { method: 'PUT', body: { testcases } })
    return { id, created: p.status === 201, tcCount: tc.body?.data?.count }
  }

  /** Xuất bản mục. Phải kiểm lời giải mẫu TRƯỚC, vì cổng FR-D6 chặn mục chưa kiểm. */
  async function validateAndPublish(problemId, title) {
    const v = await admin(`/api/mentor/problems/${problemId}/validate`, { method: 'POST', body: {} })
    if (v.status !== 201) return { itemId: null, validated: false }
    await waitFor(async () => (await admin(`/api/mentor/problems/${problemId}`)).body?.meta?.validated === true,
      120_000, `kiểm lời giải mẫu của "${title}"`)
    return { itemId: await publishItem(problemId, title), validated: true }
  }

  async function publishItem(problemId, title) {
    const section = await admin(`/api/mentor/courses/${courseId}/sections`, { method: 'POST', body: { title: `Chương ${title}` } })
    const item = await admin(`/api/mentor/courses/${courseId}/items`, {
      method: 'POST',
      body: { sectionId: section.body?.data?.id, kind: 'problem', title, problemId },
    })
    await admin(`/api/mentor/courses/${courseId}/items/${item.body?.data?.id}`, { method: 'PATCH', body: { status: 'published' } })
    return item.body?.data?.id
  }

  const main1 = await makeProblem('Tổng hai số (e2e)', TESTCASES)
  const problemId = main1.id
  check('tạo bài tập', main1.created, JSON.stringify(main1))
  check('nạp 4 testcase (1 mẫu, 3 ẩn)', main1.tcCount === 4, `count=${main1.tcCount}`)

  const validate = await admin(`/api/mentor/problems/${problemId}/validate`, { method: 'POST', body: {} })
  check('xếp lượt kiểm bằng lời giải mẫu (FR-D6)', validate.status === 201, JSON.stringify(validate.body))
  await waitFor(async () => (await admin(`/api/mentor/problems/${problemId}`)).body?.meta?.validated === true, 120_000, 'kiểm lời giải mẫu xong')
  check('lời giải mẫu AC toàn bộ testcase → bài chuyển "đã kiểm"', true)

  const itemId = await publishItem(problemId, 'Tổng hai số')
  check('xuất bản mục bài tập', Boolean(itemId))

  /** Nộp rồi đợi chấm xong; nhường một nhịp nếu chạm giới hạn tần suất. */
  async function submitAndWait(cli, { languageId, source, contestProblemId, itemId: forItem, timeout = 120_000 }) {
    const body = contestProblemId
      ? { contestProblemId, languageId, source }
      : { itemId: forItem ?? itemId, languageId, source }
    let res = await cli('/api/member/submissions', { method: 'POST', body })
    if (res.status === 429) {
      await sleep((res.body?.error?.details?.retryAfterSec ?? 20) * 1000 + 500)
      res = await cli('/api/member/submissions', { method: 'POST', body })
    }
    if (res.status !== 201) return { submitStatus: res.status, submitBody: res.body, detail: null }
    const id = res.body.data.id
    const detail = await waitFor(async () => {
      const d = await cli(`/api/member/submissions/${id}`)
      return d.body?.data?.status === 'done' ? d.body.data : null
    }, timeout, `bài nộp ${id} chấm xong`)
    return { submitStatus: 201, detail, id }
  }

  // ── 3. AC trên mọi ngôn ngữ đang bật ──────────────────────────────────────
  console.log('\n3. AC trên container thật, từng ngôn ngữ')
  const enabledIds = ((await pool[0]('/api/member/languages')).body?.data ?? []).map((l) => l.id)
  check('API trả danh sách ngôn ngữ đang bật', enabledIds.length > 0, JSON.stringify(enabledIds))

  for (const id of ['c11', 'cpp17', 'python3', 'java17', 'node20']) {
    if (!enabledIds.includes(id)) {
      console.log(`  · ${id}: đang tắt trong DB, bỏ qua`)
      continue
    }
    const { detail } = await submitAndWait(nextMember(), { languageId: id, source: SRC[id].ac, timeout: 180_000 })
    check(`${id}: AC 4/4, điểm 100`, detail?.verdict === 'AC' && detail?.score === 100,
      `verdict=${detail?.verdict} score=${detail?.score} compile=${(detail?.compileOutput ?? '').slice(0, 160)}`)
    check(`${id}: có kết quả cho đủ 4 testcase`, detail?.results?.length === 4, `nhận ${detail?.results?.length}`)
    check(`${id}: thời gian và bộ nhớ được đo`,
      typeof detail?.timeMsMax === 'number' && typeof detail?.memoryKbMax === 'number' && detail.memoryKbMax > 0,
      `time=${detail?.timeMsMax} mem=${detail?.memoryKbMax}`)
  }

  // ── 4. Mọi verdict, từ hành vi thật ───────────────────────────────────────
  console.log('\n4. Mọi verdict, sinh từ hành vi thật của chương trình')

  const wa = await submitAndWait(nextMember(), { languageId: 'c11', source: SRC.c11.wa })
  check('WA khi in sai kết quả', wa.detail?.verdict === 'WA', `verdict=${wa.detail?.verdict}`)
  check('WA: testcase MẪU chỉ ra đúng dòng lệch cho người học',
    wa.detail?.results?.[0]?.verdict === 'WA' && typeof wa.detail?.results?.[0]?.firstDiffLine === 'number',
    JSON.stringify(wa.detail?.results?.[0]))

  const tle = await submitAndWait(nextMember(), { languageId: 'c11', source: SRC.c11.tle })
  check('TLE khi lặp vô hạn', tle.detail?.verdict === 'TLE', `verdict=${tle.detail?.verdict}`)
  check('TLE: thời gian đo được chạm giới hạn của bài', (tle.detail?.timeMsMax ?? 0) >= 900, `time=${tle.detail?.timeMsMax}`)

  const mle = await submitAndWait(nextMember(), { languageId: 'c11', source: SRC.c11.mle })
  check('MLE hoặc RE khi cấp phát vượt 256 MB (kernel giết bằng OOM)',
    mle.detail?.verdict === 'MLE' || mle.detail?.verdict === 'RE', `verdict=${mle.detail?.verdict}`)

  const re = await submitAndWait(nextMember(), { languageId: 'c11', source: SRC.c11.re })
  check('RE khi ghi vào con trỏ NULL', re.detail?.verdict === 'RE', `verdict=${re.detail?.verdict}`)
  check('RE: ghi lại tín hiệu hoặc mã thoát khác 0',
    (re.detail?.results ?? []).some((r) => r.termSignal !== null || (r.exitCode ?? 0) !== 0),
    JSON.stringify(re.detail?.results?.[0]))

  const ce = await submitAndWait(nextMember(), { languageId: 'c11', source: SRC.c11.ce })
  check('CE khi sai cú pháp', ce.detail?.verdict === 'CE', `verdict=${ce.detail?.verdict}`)
  // KHÔNG kiểm `length > 0`: chuỗi dự phòng "Biên dịch thất bại." cũng thoả, và
  // đó chính là cách lỗi nuốt stderr của compiler sống sót qua mọi bộ test.
  check('CE: trả CHẨN ĐOÁN THẬT của compiler, không phải câu chung chung',
    /error/i.test(ce.detail?.compileOutput ?? '') && (ce.detail?.compileOutput ?? '').includes('main.c'),
    JSON.stringify((ce.detail?.compileOutput ?? '').slice(0, 200)))
  check('CE: không chạy testcase nào', (ce.detail?.results ?? []).length === 0, `có ${ce.detail?.results?.length} kết quả`)

  // ── 5. Điểm từng phần ─────────────────────────────────────────────────────
  console.log('\n5. Chấm điểm từng phần (FR-F2)')
  const partial = await submitAndWait(nextMember(), { languageId: 'c11', source: SRC.c11.partial })
  const okCount = (partial.detail?.results ?? []).filter((r) => r.verdict === 'AC').length
  check('bài đúng một phần không được tính AC', partial.detail?.verdict !== 'AC', `verdict=${partial.detail?.verdict}`)
  check('đúng đúng 2/4 testcase như thiết kế của bộ test', okCount === 2, `đúng ${okCount}/4`)
  check('điểm = (test đúng / tổng) × 100, làm tròn 2 chữ số',
    partial.detail?.score === Math.round((okCount / 4) * 100 * 100) / 100,
    `đúng ${okCount}/4 nhưng điểm=${partial.detail?.score}`)

  // ── 6. Chống rò testcase ẩn ───────────────────────────────────────────────
  console.log('\n6. Chống rò testcase ẩn (NFR-2)')
  const leak = await makeProblem('Bài soi rò rỉ (e2e)', LEAK_TESTCASES)
  const leakPub = await validateAndPublish(leak.id, 'Bài soi rò rỉ')
  const leakItemId = leakPub.itemId
  check('tạo bài có canary trong CẢ input ẩn lẫn expected ẩn', leak.created && leak.tcCount === 3)
  check('lời giải mẫu vẫn AC dù test ẩn có rác phía sau → bài xuất bản được',
    leakPub.validated && Boolean(leakItemId), JSON.stringify(leakPub))

  const leakCli = nextMember()
  const leakSub = await submitAndWait(leakCli, { languageId: 'c11', source: SRC.c11.ac, itemId: leakItemId })
  check('bài đọc đúng định dạng vẫn AC được test ẩn có rác phía sau',
    leakSub.detail?.results?.[1]?.verdict === 'AC', JSON.stringify(leakSub.detail?.results?.[1]))

  const seen = []
  for (const path of [
    `/api/member/problems?itemId=${leakItemId}`,
    `/api/member/submissions?itemId=${leakItemId}`,
    `/api/member/submissions/${leakSub.id}`,
    `/api/member/courses/${courseId}/syllabus`,
  ]) {
    seen.push(JSON.stringify((await leakCli(path)).body))
  }
  const all = seen.join('\n')
  check('không byte nào member nhận được chứa INPUT của testcase ẩn', !all.includes(CANARY),
    'canary của input ẩn xuất hiện trong phản hồi gửi cho member')
  check('không byte nào member nhận được chứa EXPECTED của testcase ẩn', !all.includes(CANARY_NUM),
    'canary của expected ẩn xuất hiện trong phản hồi gửi cho member')
  check('không rò lời giải tham khảo', !all.includes('scanf("%lld %lld"'))
  // Serializer KHÔNG đặt các trường này thành null — nó bỏ hẳn key đi
  // (serialize/submission.ts: nhánh `!row.isSample`). Chốt đúng bộ key được phép,
  // để mai này ai thêm một trường vào nhánh test ẩn là đỏ ngay.
  const hidden = (leakSub.detail?.results ?? []).filter((r) => !r.isSample)
  const ALLOWED = ['position', 'isSample', 'verdict', 'timeMs', 'memoryKb', 'detail']
  check('kết quả test ẩn chỉ mang đúng 6 trường vô hại',
    hidden.length === 2 && hidden.every((r) => Object.keys(r).sort().join() === [...ALLOWED].sort().join()),
    JSON.stringify(hidden))
  check('test ẩn không có key stdout / stderr / diff / exit code',
    hidden.every((r) => !('stdout' in r) && !('stderr' in r) && !('firstDiffLine' in r) && !('exitCode' in r)),
    JSON.stringify(hidden))
  check('số testcase ẩn chỉ lộ ra dưới dạng con số',
    (await leakCli(`/api/member/problems?itemId=${leakItemId}`)).body?.data?.hiddenTestcaseCount === 2)

  // ── 7. Chạy thử ───────────────────────────────────────────────────────────
  console.log('\n7. Chạy thử — không tính điểm (FR-F1)')
  const runCli = nextMember()
  async function runAndWait(body) {
    const res = await runCli('/api/member/submissions/runs', { method: 'POST', body: { itemId, ...body } })
    if (res.status !== 201) return { status: res.status, body: res.body, detail: null }
    return {
      status: 201,
      detail: await waitFor(async () => {
        const d = await runCli(`/api/member/submissions/${res.body.data.id}`)
        return d.body?.data?.status === 'done' ? d.body.data : null
      }, 120_000, 'chạy thử xong'),
    }
  }
  const runSample = await runAndWait({ languageId: 'c11', source: SRC.c11.ac, target: 'samples' })
  check('chạy thử trên testcase mẫu được nhận', runSample.status === 201, JSON.stringify(runSample.body))
  check('chạy thử CHỈ chạy testcase mẫu, không đụng test ẩn',
    runSample.detail?.results?.length === 1, `chạy ${runSample.detail?.results?.length} test`)
  check('chạy thử trả stdout cho người học xem',
    (runSample.detail?.results?.[0]?.stdout ?? '').trim() === '3', JSON.stringify(runSample.detail?.results?.[0]))

  const runCustom = await runAndWait({ languageId: 'c11', source: SRC.c11.ac, target: 'custom', customInput: '111 222\n' })
  check('chạy thử với input tự nhập trả đúng kết quả',
    (runCustom.detail?.results?.[0]?.stdout ?? '').trim() === '333', JSON.stringify(runCustom.detail?.results?.[0]))

  const hist = await runCli(`/api/member/submissions?itemId=${itemId}`)
  check('chạy thử KHÔNG lọt vào lịch sử nộp bài',
    (hist.body?.data ?? []).every((s) => s.kind !== 'run'),
    JSON.stringify((hist.body?.data ?? []).map((s) => s.kind)))

  // ── 8. Giới hạn tần suất ──────────────────────────────────────────────────
  console.log('\n8. Giới hạn tần suất (§4.2)')
  const flood = pool[0]
  const codes = []
  for (let i = 0; i < 10; i++) {
    const r = await flood('/api/member/submissions', { method: 'POST', body: { itemId, languageId: 'c11', source: SRC.c11.ac } })
    codes.push(r.status)
  }
  check('nộp dồn dập bị chặn bằng 429, không phải 500', codes.includes(429) && !codes.includes(500), JSON.stringify(codes))
  check('chặn bằng giới hạn tần suất hoặc trần bài đang chờ, không phải lỗi hệ thống',
    codes.every((s) => s === 201 || s === 429), JSON.stringify(codes))

  // ── 9. Nộp đồng thời ──────────────────────────────────────────────────────
  console.log('\n9. Nhiều người nộp đồng thời')
  const racers = [pool[1], pool[2], pool[3], pool[4]]
  const raced = await Promise.all(racers.map((cli) => submitAndWait(cli, { languageId: 'c11', source: SRC.c11.ac, timeout: 180_000 })))
  check('4 người nộp cùng lúc đều được chấm xong',
    raced.every((r) => r.detail?.status === 'done'), JSON.stringify(raced.map((r) => r.detail?.status ?? r.submitStatus)))
  check('4 người nộp cùng lúc đều AC — kết quả không lẫn sang nhau',
    raced.every((r) => r.detail?.verdict === 'AC' && r.detail?.score === 100),
    JSON.stringify(raced.map((r) => r.detail?.verdict)))

  // ── 10. Contest ───────────────────────────────────────────────────────────
  console.log('\n10. Nộp bài trong contest và bảng xếp hạng (FR-I)')
  const now = Date.now()
  const contest = await admin('/api/mentor/contests', {
    method: 'POST',
    body: {
      title: `Contest e2e ${STAMP}`,
      courseId,
      startAt: new Date(now - 3_600_000).toISOString(),
      endAt: new Date(now + 3_600_000).toISOString(),
    },
  })
  const contestId = contest.body?.data?.id
  check('tạo contest đang diễn ra', contest.status === 201, JSON.stringify(contest.body))

  const cp = await admin(`/api/mentor/contests/${contestId}/problems`, {
    method: 'PUT',
    body: { problems: [{ problemId, label: 'A', maxScore: 100 }] },
  })
  check('gắn bài vào contest', cp.status === 200, JSON.stringify(cp.body))
  const publish = await admin(`/api/mentor/contests/${contestId}/publish`, { method: 'POST', body: { confirm: true } })
  check('xuất bản contest', publish.status === 200, JSON.stringify(publish.body))

  const ctCli = pool[1]
  const detail = await ctCli(`/api/member/contests/${contestId}`)
  const contestProblemId = detail.body?.data?.problems?.[0]?.id
  check('member mở được contest và thấy bài A', Boolean(contestProblemId), JSON.stringify(detail.body?.data?.problems))

  const ctAc = await submitAndWait(ctCli, { languageId: 'c11', source: SRC.c11.ac, contestProblemId })
  check('nộp trong contest được chấm AC', ctAc.detail?.verdict === 'AC', `verdict=${ctAc.detail?.verdict}`)

  const ctPartial = await submitAndWait(pool[2], { languageId: 'c11', source: SRC.c11.partial, contestProblemId })
  check('người thứ hai nộp bài đúng một phần', ctPartial.detail?.verdict !== 'AC', `verdict=${ctPartial.detail?.verdict}`)

  const st = (await ctCli(`/api/member/contests/${contestId}/standings`)).body?.data ?? []
  const mine = st.find((r) => r.isMe)
  check('bảng xếp hạng ghi nhận ngay bài vừa AC', mine?.totalPoints === 100, JSON.stringify(st.map((r) => r.totalPoints)))
  check('người AC xếp trên người chỉ đúng một phần',
    st.length >= 2 && st[0].totalPoints > st[1].totalPoints, JSON.stringify(st.map((r) => r.totalPoints)))
  check('điểm contest = tỉ lệ test đúng × maxScore', st.some((r) => r.totalPoints === 50),
    JSON.stringify(st.map((r) => r.totalPoints)))

  // ── 11. Chấm lại ──────────────────────────────────────────────────────────
  console.log('\n11. Chấm lại sau khi sửa testcase (FR-D9)')
  const noConfirm = await admin(`/api/mentor/problems/${problemId}/rejudge`, { method: 'POST', body: { reason: 'e2e' } })
  check('chấm lại BẮT BUỘC xác nhận, vì nó đổi điểm của người khác',
    noConfirm.status === 409 && noConfirm.body?.error?.code === 'rejudge_confirm_required', JSON.stringify(noConfirm.body))

  const broken = TESTCASES.map((t, i) => (i === 1 ? { ...t, expected: '999\n' } : t))
  await admin(`/api/mentor/problems/${problemId}/testcases`, { method: 'PUT', body: { testcases: broken } })
  const before = (await ctCli(`/api/member/submissions?itemId=${itemId}`)).body?.data ?? []
  check('sửa expected của một test ẩn cho sai đi', true)

  const rj = await admin(`/api/mentor/problems/${problemId}/rejudge`, { method: 'POST', body: { confirm: true, reason: 'e2e' } })
  check('xếp lượt chấm lại cho cả bài', rj.status === 200 && rj.body?.data?.queued > 0, JSON.stringify(rj.body))

  const acCli = pool[1]
  const changed = await waitFor(async () => {
    const list = (await acCli(`/api/member/submissions?itemId=${itemId}`)).body?.data ?? []
    return list.find((s) => s.verdict === 'WA') ?? null
  }, 180_000, 'bài từng AC đổi thành WA sau chấm lại')
  check('bài từng AC trở thành WA vì expected đã đổi', changed?.verdict === 'WA', JSON.stringify(changed))
  check('điểm giảm theo chứ không giữ điểm cũ', typeof changed?.score === 'number' && changed.score < 100, `score=${changed?.score}`)

  await admin(`/api/mentor/problems/${problemId}/testcases`, { method: 'PUT', body: { testcases: TESTCASES } })
  await admin(`/api/mentor/problems/${problemId}/rejudge`, { method: 'POST', body: { confirm: true, reason: 'e2e-khoi-phuc' } })
  const restored = await waitFor(async () => {
    const list = (await acCli(`/api/member/submissions?itemId=${itemId}`)).body?.data ?? []
    const s = list.find((x) => x.id === changed.id)
    return s?.verdict === 'AC' ? s : null
  }, 180_000, 'chấm lại lần hai trả về AC')
  check('sửa testcase đúng lại thì chấm lại cho AC trở lại',
    restored?.verdict === 'AC' && restored?.score === 100, JSON.stringify(restored))
  check('chấm lại giữ nguyên số bài nộp, không nhân bản',
    ((await acCli(`/api/member/submissions?itemId=${itemId}`)).body?.data ?? []).length === before.length,
    `trước ${before.length}`)

  const auditRows = (await admin('/api/admin/audit?limit=100')).body?.data ?? []
  check('mỗi lần chấm lại để lại vết kiểm toán (FR-D9)',
    (Array.isArray(auditRows) ? auditRows : auditRows.items ?? []).some((r) => r.action === 'problem.rejudge'),
    JSON.stringify(auditRows).slice(0, 200))

  // ── 12. Cổng chặn quanh luồng chấm ────────────────────────────────────────
  console.log('\n12. Cổng chặn quanh luồng chấm')
  const oSubmit = await outsider('/api/member/submissions', { method: 'POST', body: { itemId, languageId: 'c11', source: SRC.c11.ac } })
  check('người chưa ghi danh không nộp được', oSubmit.status === 403 || oSubmit.status === 404, `status=${oSubmit.status}`)

  const badLang = await outsider('/api/member/submissions', { method: 'POST', body: { itemId, languageId: 'khong-co-ngon-ngu', source: 'x' } })
  check('ngôn ngữ không tồn tại bị từ chối, không đẩy vào hàng đợi',
    badLang.status === 400 || badLang.status === 403 || badLang.status === 404, `status=${badLang.status}`)

  // Phải là người ĐÃ ghi danh: người ngoài khoá bị cổng truy cập chặn trước bằng
  // 404, nên sẽ không chứng minh được gì về giới hạn kích thước.
  const huge = await pool[3]('/api/member/submissions', { method: 'POST', body: { itemId, languageId: 'c11', source: 'x'.repeat(70_000) } })
  check('mã nguồn vượt 64 KB bị từ chối', huge.status === 400, `status=${huge.status} ${JSON.stringify(huge.body?.error?.code)}`)

  // ── 13. Bài dạng function ─────────────────────────────────────────────────
  console.log('\n13. Bài dạng function, kiểu LeetCode (FR-D10)')

  const noHarness = await admin('/api/mentor/problems', {
    method: 'POST',
    body: { title: 'Thiếu harness', kind: 'function', statementMd: 'x' },
  })
  check('bài function KHÔNG có harness bị từ chối ngay lúc tạo',
    noHarness.status === 400, `status=${noHarness.status} ${JSON.stringify(noHarness.body?.error?.message)}`)

  const fnProblem = await admin('/api/mentor/problems', {
    method: 'POST',
    body: {
      title: 'Two Sum (e2e)',
      kind: 'function',
      harness: FN.harness,
      statementMd: 'Cho mảng `nums` và số `target`, trả về chỉ số hai phần tử có tổng bằng target.',
      timeLimitMs: 2000,
      solutionLanguageId: 'c11',
      solutionSource: FN.ac.c11,
      starterCode: { c11: 'int *twoSum(int *nums,int n,int target,int *returnSize){\n    // code ở đây\n}\n' },
    },
  })
  const fnId = fnProblem.body?.data?.id
  check('tạo bài function có harness cho C và Python', fnProblem.status === 201, JSON.stringify(fnProblem.body))

  const fnTc = await admin(`/api/mentor/problems/${fnId}/testcases`, { method: 'PUT', body: { testcases: FN.testcases } })
  check('nạp 3 testcase cho bài function', fnTc.body?.data?.count === 3, JSON.stringify(fnTc.body))

  const fnPub = await validateAndPublish(fnId, 'Two Sum')
  check('lời giải mẫu dạng function kiểm được và bài xuất bản được (FR-D6)',
    fnPub.validated && Boolean(fnPub.itemId), JSON.stringify(fnPub))
  const fnItemId = fnPub.itemId

  const fnAcC = await submitAndWait(nextMember(), { languageId: 'c11', source: FN.ac.c11, itemId: fnItemId })
  check('C: chỉ nộp một HÀM, không có main → AC 3/3',
    fnAcC.detail?.verdict === 'AC' && fnAcC.detail?.score === 100,
    `verdict=${fnAcC.detail?.verdict} compile=${(fnAcC.detail?.compileOutput ?? '').slice(0, 160)}`)

  const fnAcPy = await submitAndWait(nextMember(), { languageId: 'python3', source: FN.ac.python3, itemId: fnItemId })
  check('Python: cùng bài, cùng testcase, cũng AC — harness theo từng ngôn ngữ',
    fnAcPy.detail?.verdict === 'AC' && fnAcPy.detail?.score === 100, `verdict=${fnAcPy.detail?.verdict}`)

  const fnWa = await submitAndWait(nextMember(), { languageId: 'c11', source: FN.wa.c11, itemId: fnItemId })
  check('hàm trả chỉ số ngược → WA, lỗi đến từ hàm người học chứ không phải harness',
    fnWa.detail?.verdict === 'WA', `verdict=${fnWa.detail?.verdict}`)

  const fnCe = await submitAndWait(nextMember(), { languageId: 'python3', source: FN.ce.python3, itemId: fnItemId })
  check('hàm sai cú pháp → CE chứ không phải RE khó hiểu', fnCe.detail?.verdict === 'CE',
    `verdict=${fnCe.detail?.verdict}`)
  check('CE của bài function chỉ đúng file và dòng NGƯỜI HỌC viết',
    (fnCe.detail?.compileOutput ?? '').includes('solution.py') &&
      !(fnCe.detail?.compileOutput ?? '').includes('main.py'),
    JSON.stringify((fnCe.detail?.compileOutput ?? '').slice(0, 200)))
  check('CE không để lộ mã harness qua dòng trích nguồn của compiler',
    !(fnCe.detail?.compileOutput ?? '').includes('from solution import'),
    JSON.stringify((fnCe.detail?.compileOutput ?? '').slice(0, 200)))

  const fnBadLang = await nextMember()('/api/member/submissions', {
    method: 'POST',
    body: { itemId: fnItemId, languageId: 'cpp17', source: 'x' },
  })
  check('ngôn ngữ chưa có harness bị chặn NGAY LÚC NỘP, không để thành IE lúc chấm',
    fnBadLang.status === 400, `status=${fnBadLang.status}`)

  const fnView = (await nextMember()(`/api/member/problems?itemId=${fnItemId}`)).body
  check('member biết đây là bài dạng function', fnView?.data?.kind === 'function', JSON.stringify(fnView?.data?.kind))
  check('member nhận được starter code để điền vào', Boolean(fnView?.data?.starterCode?.c11))
  check('harness KHÔNG rò sang member',
    !JSON.stringify(fnView).includes('#include "solution.c"') && !JSON.stringify(fnView).includes('from solution import'),
    'harness xuất hiện trong đề bài gửi cho member')

  await waitFor(async () => {
    const q = (await admin('/api/admin/judge')).body?.data?.queue
    return (q?.pendingSubmit ?? 0) === 0 && (q?.pendingRun ?? 0) === 0 && (q?.running ?? 0) === 0
  }, 180_000, 'hàng đợi rút cạn').catch(() => null)
  const finalQueue = (await admin('/api/admin/judge')).body?.data?.queue
  check('kết thúc: hàng đợi rỗng, không bài nào kẹt',
    (finalQueue?.pendingSubmit ?? 0) === 0 && (finalQueue?.running ?? 0) === 0, JSON.stringify(finalQueue))

  const ie = (await admin('/api/admin/judge')).body?.data?.ieSubmissions ?? []
  check('không bài nào rơi vào lỗi nội bộ (IE) suốt cả lượt chạy', ie.length === 0,
    JSON.stringify(ie.map((r) => r.ieReason)))

  finish()
}

function finish() {
  console.log(`\n${'─'.repeat(60)}`)
  if (failures.length === 0) {
    console.log(`✓ Luồng chấm bài: ${passed} kiểm tra, tất cả đạt.`)
    process.exit(0)
  }
  console.log(`✗ Luồng chấm bài: ${passed} đạt, ${failures.length} hỏng:`)
  for (const f of failures) console.log(`   - ${f}`)
  process.exit(1)
}

// KHÔNG gọi finish() ở đây. finish() thoát 0 khi mảng failures rỗng, mà một ngoại
// lệ giữa chừng — `waitFor` hết giờ vì worker chết, `fetch failed` vì sai cổng — làm
// mảng đó rỗng đúng nghĩa: chưa kiểm tra nào kịp chạy. Bản trước vì thế in
// "✓ Luồng chấm bài: 0 kiểm tra, tất cả đạt." rồi thoát 0. 93 kiểm tra biến mất
// không dấu vết, và CI xanh.
main().catch((err) => {
  console.error(`\nDừng giữa chừng: ${err.message}`)
  process.exit(1)
})
