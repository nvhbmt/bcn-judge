/**
 * Bài đọc trong giáo trình — đường ĐỌC của member.
 *
 * Mentor soạn được bài đọc từ lâu (`lesson_body_md` có trong schema, form của mentor
 * ghi vào đó), nhưng không endpoint member nào trả nó ra: giao diện gửi mọi mục vào
 * `/api/member/problems` và nhận 404. Tức là nội dung lý thuyết đã nằm sẵn trong CSDL
 * mà không ai đọc được — hỏng lặng lẽ, vì trang vẫn mở, chỉ là trống.
 *
 * Phần đáng canh nhất ở đây không phải "đọc được", mà là bài đọc chịu ĐÚNG cổng kiểm
 * của bài tập: chưa xuất bản, chưa tới giờ mở, hay chưa ghi danh thì không được lộ.
 */
import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { q } from '../db/pool'
import {
  INTEGRATION,
  assignMentor,
  call,
  enroll,
  makeCourse,
  makeItem,
  makeProblem,
  makeUser,
  resetDb,
  setupDb,
  type TestUser,
} from '../testing/harness'

/** Bài ĐỌC: kind='lesson', không problem_id. */
async function makeLesson(
  courseId: string,
  over: { status?: 'draft' | 'published'; visibleFrom?: Date | null; body?: string | null } = {},
): Promise<string> {
  const [section] = await q<{ id: string }>(sql`
    INSERT INTO sections (course_id, title, position) VALUES (${courseId}, 'Chương 1', 1) RETURNING id
  `)
  const [item] = await q<{ id: string }>(sql`
    INSERT INTO items (section_id, kind, title, position, status, lesson_body_md, visible_from)
    VALUES (${section!.id}, 'lesson', 'Đọc và ghi dữ liệu chuẩn', 1,
            ${over.status ?? 'published'},
            ${over.body === undefined ? 'Đọc từ **stdin**, in ra **stdout**.' : over.body},
            ${over.visibleFrom ?? null})
    RETURNING id
  `)
  return item!.id
}

describe.skipIf(!INTEGRATION)('bài đọc của giáo trình', () => {
  let admin: TestUser
  let mentor: TestUser
  let member: TestUser
  let outsider: TestUser
  let course: { id: string; code: string }

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    admin = await makeUser('admin')
    mentor = await makeUser('mentor')
    member = await makeUser('member')
    outsider = await makeUser('member')
    course = await makeCourse(admin.id)
    await assignMentor(course.id, mentor.id)
    await enroll(course.id, member.id)
  })

  it('member đã ghi danh đọc được thân bài', async () => {
    const id = await makeLesson(course.id)
    const res = await call(`/api/member/items/${id}/lesson`, { as: member })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      id,
      title: 'Đọc và ghi dữ liệu chuẩn',
      courseId: course.id,
    })
    expect(res.body.data.bodyMd).toContain('stdin')
  })

  it('bài đọc chưa có thân vẫn mở được, chỉ là rỗng', async () => {
    const id = await makeLesson(course.id, { body: null })
    const res = await call(`/api/member/items/${id}/lesson`, { as: member })
    expect(res.status).toBe(200)
    expect(res.body.data.bodyMd).toBeNull()
  })

  describe('cổng kiểm dùng chung với bài tập', () => {
    it('chưa ghi danh thì 404', async () => {
      const id = await makeLesson(course.id)
      expect((await call(`/api/member/items/${id}/lesson`, { as: outsider })).status).toBe(404)
    })

    it('chưa xuất bản thì member không thấy', async () => {
      const id = await makeLesson(course.id, { status: 'draft' })
      expect((await call(`/api/member/items/${id}/lesson`, { as: member })).status).toBe(404)
    })

    it('hẹn giờ mở: trước giờ thì KHÔNG lộ, sau giờ thì mở', async () => {
      const sau = await makeLesson(course.id, { visibleFrom: new Date(Date.now() + 3_600_000) })
      expect((await call(`/api/member/items/${sau}/lesson`, { as: member })).status).toBe(404)

      const truoc = await makeLesson(course.id, { visibleFrom: new Date(Date.now() - 3_600_000) })
      expect((await call(`/api/member/items/${truoc}/lesson`, { as: member })).status).toBe(200)
    })

    it('mentor của khoá và admin đi thẳng, kể cả bản nháp chưa tới giờ', async () => {
      const id = await makeLesson(course.id, {
        status: 'draft',
        visibleFrom: new Date(Date.now() + 3_600_000),
      })
      expect((await call(`/api/member/items/${id}/lesson`, { as: mentor })).status).toBe(200)
      expect((await call(`/api/member/items/${id}/lesson`, { as: admin })).status).toBe(200)
    })

    it('chưa đăng nhập thì không đi được', async () => {
      const id = await makeLesson(course.id)
      expect((await call(`/api/member/items/${id}/lesson`)).status).toBe(401)
    })
  })

  it('đưa id của một BÀI TẬP vào đường bài đọc thì 404, không trả nhầm', async () => {
    // Hai đường tách nhau theo `kind`, nên không đường nào phục vụ mục của đường kia.
    const problemId = await makeProblem(mentor.id, { title: 'Tổng hai số' })
    const itemId = await makeItem(course.id, problemId)

    expect((await call(`/api/member/items/${itemId}/lesson`, { as: member })).status).toBe(404)
    // Và ngược lại: đường bài tập vẫn phục vụ đúng mục đó.
    expect((await call(`/api/member/problems?itemId=${itemId}`, { as: member })).status).toBe(200)
  })
})
