/**
 * Đếm mentor / member trên danh sách khoá (FR-B1/B2).
 *
 * Chốt sự cố: `memberCount` luôn trả **0** dù khoá có 32 người ghi danh, ở CẢ hai
 * đường admin và mentor. Nguyên nhân không nhìn ra được khi đọc code:
 *
 *     memberCount: sql`(select count(*)::int from course_enrollments ce
 *                       where ce.course_id = ${courses.id} and ce.status = 'active')`
 *
 * Drizzle render nội suy cột thành `"id"` KHÔNG kèm tên bảng. `course_enrollments`
 * có cột `id` của riêng nó, nên truy vấn con thành `ce.course_id = ce.id` — không bao
 * giờ đúng, và đếm ra 0 mà không báo lỗi gì. Câu `mentorCount` viết y hệt lại chạy
 * đúng, vì `course_mentors` khoá chính ghép nên KHÔNG có cột `id` và `"id"` rơi ra
 * ngoài đúng `courses.id`. Một câu đúng do may, một câu sai lặng lẽ, cùng một dòng mẫu.
 *
 * Nên test phải đếm với số KHÁC 0 và KHÁC nhau giữa hai loại — đếm 1-1 thì một lỗi
 * hoán vị hai câu vẫn xanh.
 */
import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { q } from '../db/pool'
import {
  INTEGRATION,
  assignMentor,
  call,
  enroll,
  addTestcases,
  makeCourse,
  makeItem,
  makeProblem,
  makeUser,
  resetDb,
  setupDb,
  type TestUser,
} from '../testing/harness'

describe.skipIf(!INTEGRATION)('GET /api/{admin,mentor}/courses — đếm mentor và member', () => {
  let admin: TestUser
  let mentor: TestUser
  let courseId: string

  beforeAll(setupDb)

  beforeEach(async () => {
    await resetDb()
    admin = await makeUser('admin')
    mentor = await makeUser('mentor')
    courseId = (await makeCourse(admin.id, { status: 'open' })).id

    // Hai mentor và BA member: ba con số phải khác nhau để không có cách nào
    // "đúng nhầm" — 2 ≠ 3, và cả hai ≠ 0.
    await assignMentor(courseId, mentor.id)
    await assignMentor(courseId, (await makeUser('mentor')).id)
    for (let i = 0; i < 3; i += 1) await enroll(courseId, (await makeUser('member')).id)
  })

  it('đường admin đếm đúng 2 mentor và 3 member', async () => {
    const res = await call('/api/admin/courses', { as: admin })
    expect(res.status).toBe(200)
    const row = res.body.data.find((r: { id: string }) => r.id === courseId)
    expect(row).toBeTruthy()
    expect(row.mentorCount).toBe(2)
    expect(row.memberCount).toBe(3)
  })

  it('đường mentor đếm đúng 3 member', async () => {
    const res = await call('/api/mentor/courses', { as: mentor })
    expect(res.status).toBe(200)
    const row = res.body.data.find((r: { id: string }) => r.id === courseId)
    expect(row).toBeTruthy()
    expect(row.memberCount).toBe(3)
  })

  it('gỡ ghi danh thì số member giảm — đếm theo status, không đếm dòng đã gỡ', async () => {
    const before = await call('/api/admin/courses', { as: admin })
    const target = before.body.data.find((r: { id: string }) => r.id === courseId)
    expect(target.memberCount).toBe(3)

    const enrolled = await call(`/api/admin/courses/${courseId}/enrollments`, { as: admin })
    const first = enrolled.body.data[0]
    expect(first).toBeTruthy()
    await call(`/api/admin/courses/${courseId}/enrollments/${first.id}`, { as: admin, method: 'DELETE' })

    const after = await call('/api/admin/courses', { as: admin })
    const row = after.body.data.find((r: { id: string }) => r.id === courseId)
    expect(row.memberCount).toBe(2)
  })
})

describe.skipIf(!INTEGRATION)('FR-B4 · member tự ghi danh bằng mã khoá', () => {
  let admin: TestUser
  let member: TestUser

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    admin = await makeUser('admin')
    member = await makeUser('member')
  })

  /** Bật cờ self_enroll qua chính API quản trị — để test đi đúng đường người dùng đi. */
  async function moKhoaTuGhiDanh(code: string) {
    const course = await makeCourse(admin.id, { code, status: 'open' })
    await call(`/api/admin/courses/${course.id}`, { as: admin, method: 'PATCH', body: { selfEnroll: true } })
    return course
  }

  it('vào được khoá đang mở có bật tự ghi danh, và thấy nó ở danh sách của mình', async () => {
    const course = await moKhoaTuGhiDanh('TUGD1')
    expect((await call('/api/member/courses', { as: member })).body.data).toHaveLength(0)

    const res = await call('/api/member/courses/tham-gia', { as: member, body: { code: 'TUGD1' } })
    expect(res.status).toBe(200)
    expect(res.body.data.courseId).toBe(course.id)

    const sau = await call('/api/member/courses', { as: member })
    expect(sau.body.data.map((c: { id: string }) => c.id)).toEqual([course.id])
  })

  it('mã KHÔNG phân biệt hoa thường — citext, không phải upper() thủ công', async () => {
    await moKhoaTuGhiDanh('TUGD2')
    expect((await call('/api/member/courses/tham-gia', { as: member, body: { code: ' tugd2 ' } })).status).toBe(200)
  })

  it('khoá KHÔNG bật cờ thì vào không được, dù mã đúng', async () => {
    await makeCourse(admin.id, { code: 'KIN1', status: 'open' })
    expect((await call('/api/member/courses/tham-gia', { as: member, body: { code: 'KIN1' } })).status).toBe(404)
  })

  it('khoá nháp / lưu trữ thì vào không được kể cả khi đã bật cờ', async () => {
    for (const status of ['draft', 'archived'] as const) {
      const course = await makeCourse(admin.id, { code: `ST-${status}`, status })
      await call(`/api/admin/courses/${course.id}`, { as: admin, method: 'PATCH', body: { selfEnroll: true } })
      const res = await call('/api/member/courses/tham-gia', { as: member, body: { code: `ST-${status}` } })
      expect(res.status).toBe(404)
    }
  })

  it('ba lý do hỏng nói CÙNG một câu — ô nhập mã không được thành máy dò', async () => {
    // Mã không tồn tại, khoá kín, khoá nháp: nếu ba câu khác nhau thì người lạ gõ thử
    // sẽ phân biệt được "mã này có thật nhưng khoá kín" với "mã này không có".
    await makeCourse(admin.id, { code: 'CO-THAT', status: 'open' })
    const [a, b] = await Promise.all([
      call('/api/member/courses/tham-gia', { as: member, body: { code: 'KHONG-CO-MA-NAY' } }),
      call('/api/member/courses/tham-gia', { as: member, body: { code: 'CO-THAT' } }),
    ])
    expect(a.status).toBe(b.status)
    expect(a.body.error.message).toBe(b.body.error.message)
  })

  it('vào lại sau khi bị gỡ thì HỒI dòng cũ, không đẻ dòng thứ hai', async () => {
    const course = await moKhoaTuGhiDanh('TUGD3')
    await call('/api/member/courses/tham-gia', { as: member, body: { code: 'TUGD3' } })
    await call(`/api/admin/courses/${course.id}/enrollments/${member.id}`, { as: admin, method: 'DELETE' })
    expect((await call('/api/member/courses', { as: member })).body.data).toHaveLength(0)

    expect((await call('/api/member/courses/tham-gia', { as: member, body: { code: 'TUGD3' } })).status).toBe(200)
    const [row] = await q<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM course_enrollments
      WHERE course_id = ${course.id} AND user_id = ${member.id}
    `)
    expect(row!.n).toBe(1)
    expect((await call('/api/member/courses', { as: member })).body.data).toHaveLength(1)
  })
})

describe.skipIf(!INTEGRATION)('FR-B6 · nhân bản khoá học', () => {
  let admin: TestUser
  let member: TestUser
  let goc: { id: string; code: string }

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    admin = await makeUser('admin')
    member = await makeUser('member')
    goc = await makeCourse(admin.id, { code: 'GOC1', status: 'open' })
    const p = await makeProblem(admin.id, { title: 'Bài A' })
    await addTestcases(p, [
      { input: '1', expected: '1', kind: 'sample' },
      { input: '2', expected: '4' },
    ])
    await makeItem(goc.id, p)
    await enroll(goc.id, member.id)
  })

  async function nhanBan(body: Record<string, string> = { code: 'BANSAO', name: 'Bản sao' }) {
    return call(`/api/admin/courses/${goc.id}/clone`, { as: admin, body })
  }

  it('chép chương, mục, bài và TESTCASE sang khoá mới', async () => {
    const res = await nhanBan()
    expect(res.status).toBe(201)
    const moi = res.body.data.id

    const [dem] = await q<{ sections: number; items: number; problems: number; testcases: number }>(sql`
      SELECT (SELECT count(*)::int FROM sections WHERE course_id = ${moi})                      AS sections,
             (SELECT count(*)::int FROM items i JOIN sections s ON s.id = i.section_id
              WHERE s.course_id = ${moi})                                                       AS items,
             (SELECT count(*)::int FROM problems WHERE scope_course_id = ${moi})                AS problems,
             (SELECT count(*)::int FROM testcases t JOIN problems p ON p.id = t.problem_id
              WHERE p.scope_course_id = ${moi})                                                 AS testcases
    `)
    expect(dem).toEqual({ sections: 1, items: 1, problems: 1, testcases: 2 })
  })

  it('mục của bản sao trỏ vào chương và bài MỚI, không trỏ ngược về khoá gốc', async () => {
    // Đây là chỗ dễ hỏng nhất: ánh xạ id cũ → mới. Trỏ nhầm thì sửa đề ở bản sao là
    // sửa luôn vào khoá đang chạy, mà không có gì báo.
    const moi = (await nhanBan()).body.data.id
    const [row] = await q<{ lac: number }>(sql`
      SELECT count(*)::int AS lac
      FROM items i
      JOIN sections s ON s.id = i.section_id
      LEFT JOIN problems p ON p.id = i.problem_id
      WHERE s.course_id = ${moi} AND (p.scope_course_id IS DISTINCT FROM ${moi})
    `)
    expect(row!.lac).toBe(0)
  })

  it('KHÔNG chép ghi danh, và khoá mới là NHÁP + tắt tự ghi danh', async () => {
    const moi = (await nhanBan()).body.data.id
    const [row] = await q<{ status: string; selfEnroll: boolean; ghiDanh: number }>(sql`
      SELECT status, self_enroll AS "selfEnroll",
             (SELECT count(*)::int FROM course_enrollments WHERE course_id = ${moi}) AS "ghiDanh"
      FROM courses WHERE id = ${moi}
    `)
    expect(row!.status).toBe('draft')
    expect(row!.selfEnroll).toBe(false)
    expect(row!.ghiDanh).toBe(0)
  })

  it('bản sao ở trạng thái CHƯA KIỂM — không mang cờ đã kiểm của bài gốc', async () => {
    await q(sql`UPDATE problems SET testcase_rev = 3, validated_testcase_rev = 3 WHERE scope_course_id IS NULL`)
    const moi = (await nhanBan()).body.data.id
    const [row] = await q<{ daKiem: boolean }>(sql`
      SELECT COALESCE(validated_testcase_rev = testcase_rev, false) AS "daKiem"
      FROM problems WHERE scope_course_id = ${moi}
    `)
    expect(row!.daKiem).toBe(false)
  })

  it('khoá gốc KHÔNG bị đụng tới', async () => {
    await nhanBan()
    const [row] = await q<{ status: string; items: number }>(sql`
      SELECT c.status,
             (SELECT count(*)::int FROM items i JOIN sections s ON s.id = i.section_id
              WHERE s.course_id = c.id) AS items
      FROM courses c WHERE c.id = ${goc.id}
    `)
    expect(row!.status).toBe('open')
    expect(row!.items).toBe(1)
  })

  it('mã trùng thì báo code_taken, không tạo khoá dở dang', async () => {
    const res = await nhanBan({ code: 'GOC1', name: 'Trùng mã' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('code_taken')
    const [row] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM courses`)
    expect(row!.n).toBe(1)
  })

  it('chỉ admin nhân bản được', async () => {
    const mentor = await makeUser('mentor')
    for (const u of [member, mentor]) {
      expect((await call(`/api/admin/courses/${goc.id}/clone`, { as: u, body: { code: 'X1', name: 'X' } })).status).toBe(403)
    }
  })
})

describe.skipIf(!INTEGRATION)('FR-H5 · banner thông báo toàn hệ thống', () => {
  let admin: TestUser
  let member: TestUser

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    admin = await makeUser('admin')
    member = await makeUser('member')
  })

  it('mặc định rỗng; admin đặt xong thì MỌI người đọc được', async () => {
    expect((await call('/api/member/announcement', { as: member })).body.data.text).toBe('')

    await call('/api/admin/settings', {
      as: admin,
      method: 'PATCH',
      body: { announcement: '  Bảo trì 22:00 hôm nay.  ' },
    })

    const res = await call('/api/member/announcement', { as: member })
    expect(res.status).toBe(200)
    // Cắt khoảng trắng ở SERVER: FE chỉ kiểm tra chuỗi rỗng, nên một chuỗi toàn dấu
    // cách mà lọt qua là banner hiện ra trống trơn.
    expect(res.body.data.text).toBe('Bảo trì 22:00 hôm nay.')
  })

  it('member KHÔNG đặt được thông báo', async () => {
    const res = await call('/api/admin/settings', { as: member, method: 'PATCH', body: { announcement: 'x' } })
    expect(res.status).toBe(403)
    expect((await call('/api/member/announcement', { as: member })).body.data.text).toBe('')
  })

  it('xoá thông báo bằng cách đặt chuỗi rỗng', async () => {
    await call('/api/admin/settings', { as: admin, method: 'PATCH', body: { announcement: 'Có' } })
    await call('/api/admin/settings', { as: admin, method: 'PATCH', body: { announcement: '' } })
    expect((await call('/api/member/announcement', { as: member })).body.data.text).toBe('')
  })
})
