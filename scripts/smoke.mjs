#!/usr/bin/env node
/**
 * Smoke test end-to-end QUA HTTP với API + worker đang chạy thật (design §10).
 *
 * Khác test tích hợp: những test kia gọi `app.request` in-process. Cái này đi qua
 * cổng TCP, cookie thật, worker là tiến trình riêng, container Docker thật — nó
 * bắt được đúng lớp lỗi mà in-process không thấy (mount route sai, cookie, CORS,
 * worker không nhận việc).
 *
 *   BASE=http://localhost:8099 node scripts/smoke.mjs
 */
const BASE = process.env.BASE ?? 'http://localhost:8099'
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@bcn.local'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'bcnjudge'
const STAMP = Date.now()

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

async function main() {
  console.log(`Smoke test → ${BASE}\n`)

  const admin = makeClient()

  console.log('1. Hạ tầng')
  const health = await admin('/healthz')
  check('healthz trả ok', health.status === 200, JSON.stringify(health.body))
  if (health.status !== 200) return finish()

  console.log('\n2. Đăng nhập admin (FR-A1)')
  let login = await admin('/auth/login', { method: 'POST', body: { emailOrUsername: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  if (login.status !== 200) {
    // Có thể admin đã đổi mật khẩu ở lần chạy trước.
    login = await admin('/auth/login', {
      method: 'POST',
      body: { emailOrUsername: ADMIN_EMAIL, password: `${ADMIN_PASSWORD}-smoke` },
    })
  }
  check('đăng nhập được', login.status === 200, JSON.stringify(login.body))
  if (login.status !== 200) return finish()

  if (login.body.data.mustChangePassword) {
    const changed = await admin('/auth/change-password', {
      method: 'POST',
      body: { currentPassword: ADMIN_PASSWORD, newPassword: `${ADMIN_PASSWORD}-smoke` },
    })
    check('đổi mật khẩu lần đầu (FR-A2)', changed.status === 200)
  }
  check('/auth/me trả đúng vai trò', (await admin('/auth/me')).body?.data?.role === 'admin')

  console.log('\n3. Cấp tài khoản và khoá học (FR-A2, FR-B1/B3)')
  const memberEmail = `smoke-member-${STAMP}@test.local`
  const created = await admin('/api/admin/users', {
    method: 'POST',
    body: { email: memberEmail, displayName: 'Member Smoke', role: 'member' },
  })
  check('tạo member, nhận mật khẩu ban đầu', created.status === 201 && created.body.data.initialPassword?.length === 10)
  const memberPassword = created.body?.data?.initialPassword

  const course = await admin('/api/admin/courses', {
    method: 'POST',
    body: { code: `smoke${STAMP}`, name: 'Khoá smoke', status: 'open' },
  })
  check('tạo khoá học', course.status === 201, JSON.stringify(course.body))
  const courseId = course.body?.data?.id

  const enrolled = await admin(`/api/admin/courses/${courseId}/enrollments`, {
    method: 'POST',
    body: { emails: [memberEmail, 'khong-ton-tai@test.local'] },
  })
  check('ghi danh và báo lại email không tồn tại (US-1)', enrolled.body?.data?.enrolled === 1 && enrolled.body?.data?.missing?.length === 1)

  console.log('\n4. Soạn bài tập và testcase (FR-D1/D4/D6)')
  const AC = '#include <stdio.h>\nint main(void){long long a,b;if(scanf("%lld %lld",&a,&b)!=2)return 1;printf("%lld\\n",a+b);return 0;}\n'
  const problem = await admin('/api/mentor/problems', {
    method: 'POST',
    body: {
      title: 'Tổng hai số (smoke)',
      statementMd: 'Cho hai số nguyên **a** và **b**. In ra tổng.',
      timeLimitMs: 2000,
      solutionLanguageId: 'c11',
      solutionSource: AC,
    },
  })
  check('tạo bài tập', problem.status === 201, JSON.stringify(problem.body))
  const problemId = problem.body?.data?.id

  const testcases = await admin(`/api/mentor/problems/${problemId}/testcases`, {
    method: 'PUT',
    body: {
      testcases: [
        { input: '1 2\n', expected: '3\n', kind: 'sample' },
        { input: '10 20\n', expected: '30\n', kind: 'hidden' },
        { input: '-5 5\n', expected: '0\n', kind: 'hidden' },
      ],
    },
  })
  check('nạp 3 testcase', testcases.body?.data?.count === 3)

  const validate = await admin(`/api/mentor/problems/${problemId}/validate`, { method: 'POST', body: {} })
  check('xếp lượt kiểm bằng lời giải mẫu (FR-D6)', validate.status === 201)

  console.log('\n5. Chương/mục và xuất bản (FR-C1/C3)')
  const section = await admin(`/api/mentor/courses/${courseId}/sections`, { method: 'POST', body: { title: 'Chương 1' } })
  const item = await admin(`/api/mentor/courses/${courseId}/items`, {
    method: 'POST',
    body: { sectionId: section.body?.data?.id, kind: 'problem', title: 'Tổng hai số', problemId },
  })
  const itemId = item.body?.data?.id
  check('tạo mục bài tập', item.status === 201, JSON.stringify(item.body))

  // Đợi worker chấm xong lượt validate để cổng publish mềm đi qua sạch.
  await waitFor(async () => {
    const p = await admin(`/api/mentor/problems/${problemId}`)
    return p.body?.meta?.validated === true
  }, 60_000)

  const publish = await admin(`/api/mentor/courses/${courseId}/items/${itemId}`, {
    method: 'PATCH',
    body: { status: 'published' },
  })
  check('xuất bản mục sau khi validate xanh', publish.status === 200, JSON.stringify(publish.body))

  console.log('\n6. Member làm bài (FR-E, FR-F)')
  const member = makeClient()
  const mLogin = await member('/auth/login', { method: 'POST', body: { emailOrUsername: memberEmail, password: memberPassword } })
  check('member đăng nhập', mLogin.status === 200)
  await member('/auth/change-password', { method: 'POST', body: { currentPassword: memberPassword, newPassword: 'smoke-password-1' } })

  const courses = await member('/api/member/courses')
  check('member thấy khoá đã ghi danh (FR-B5)', courses.body?.data?.some((r) => r.id === courseId))

  const syllabus = await member(`/api/member/courses/${courseId}/syllabus`)
  check('giáo trình có mục đã xuất bản', syllabus.body?.data?.[0]?.items?.length === 1)

  const problemView = await member(`/api/member/problems?itemId=${itemId}`)
  check('đề bài trả về cho member', problemView.status === 200)
  check('CHỈ testcase mẫu lộ ra, test ẩn chỉ là con số (NFR-2)',
    problemView.body?.data?.samples?.length === 1 && problemView.body?.data?.hiddenTestcaseCount === 2)
  check('không rò lời giải tham khảo', !JSON.stringify(problemView.body).includes('scanf'))

  const submit = await member('/api/member/submissions', {
    method: 'POST',
    body: { itemId, languageId: 'c11', source: AC },
  })
  check('nộp bài được nhận', submit.status === 201, JSON.stringify(submit.body))
  const submissionId = submit.body?.data?.id

  console.log('\n7. Worker chấm (FR-F2/F4)')
  const verdict = await waitFor(async () => {
    const detail = await member(`/api/member/submissions/${submissionId}`)
    return detail.body?.data?.status === 'done' ? detail.body.data : false
  }, 90_000)
  check('worker chấm xong trong 90 giây', verdict !== false)
  if (verdict) {
    check('verdict AC', verdict.verdict === 'AC', String(verdict.verdict))
    check('điểm chuẩn hoá 100 (FR-F2)', verdict.score === 100, String(verdict.score))
    check('có kết quả từng testcase', verdict.results?.length === 3)
    const hidden = verdict.results?.find((r) => !r.isSample)
    check('testcase ẩn KHÔNG kèm stdout/exit code (NFR-2)', hidden && hidden.stdout === undefined && hidden.exitCode === undefined)
  }

  console.log('\n8. Bài sai và giới hạn (FR-F2/F5)')
  const wrong = await member('/api/member/submissions', {
    method: 'POST',
    body: { itemId, languageId: 'c11', source: AC.replace('a+b', 'a-b') },
  })
  const wrongResult = await waitFor(async () => {
    const detail = await member(`/api/member/submissions/${wrong.body?.data?.id}`)
    return detail.body?.data?.status === 'done' ? detail.body.data : false
  }, 90_000)
  check('lời giải sai → WA', wrongResult && wrongResult.verdict === 'WA', String(wrongResult?.verdict))

  let limited = null
  for (let i = 0; i < 8; i++) {
    const res = await member('/api/member/submissions', { method: 'POST', body: { itemId, languageId: 'c11', source: AC } })
    if (res.status === 429) {
      limited = res
      break
    }
  }
  check('vượt giới hạn nộp bị chặn với 429 (FR-F5)', limited !== null, limited ? '' : 'không bị chặn sau 8 lần')

  console.log('\n9. Ranh giới quyền (NFR-3)')
  check('member không mở được đường mentor', (await member(`/api/mentor/problems/${problemId}`)).status === 403)
  check('member không mở được đường admin', (await member('/api/admin/users')).status === 403)
  check('chưa đăng nhập thì 401', (await makeClient()('/api/member/courses')).status === 401)

  finish()
}

async function waitFor(fn, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await fn()
    if (value) return value
    await sleep(500)
  }
  return false
}

function finish() {
  console.log(`\n${'─'.repeat(50)}`)
  if (failures.length === 0) {
    console.log(`✓ Smoke test: ${passed} kiểm tra, tất cả đạt.`)
    process.exit(0)
  }
  console.log(`✗ Smoke test: ${passed} đạt, ${failures.length} hỏng:`)
  for (const f of failures) console.log(`   - ${f}`)
  process.exit(1)
}

await main()
