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
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  INTEGRATION,
  assignMentor,
  call,
  enroll,
  makeCourse,
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
