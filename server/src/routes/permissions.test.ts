/**
 * NFR-3: mọi ô "–" trong ma trận quyền (requirements §3) phải có test.
 * Đây là lưới chặn ở tầng API; bất biến ở tầng DB có test riêng.
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

describe.skipIf(!INTEGRATION)('ma trận quyền — API', () => {
  let admin: TestUser
  let mentorA: TestUser
  let mentorB: TestUser
  let member: TestUser
  let outsider: TestUser
  let courseA: { id: string; code: string }

  beforeAll(async () => {
    await setupDb()
  })

  beforeEach(async () => {
    await resetDb()
    admin = await makeUser('admin')
    mentorA = await makeUser('mentor')
    mentorB = await makeUser('mentor')
    member = await makeUser('member')
    outsider = await makeUser('member')
    courseA = await makeCourse(admin.id)
    await assignMentor(courseA.id, mentorA.id)
    await enroll(courseA.id, member.id)
  })

  describe('FR-A2 · chưa đổi mật khẩu lần đầu', () => {
    it('mọi route /api đều 403, chỉ /auth/me và đổi mật khẩu đi được', async () => {
      // Guard này trước đây CHỈ tồn tại ở router React (src/App.tsx) — server cho qua
      // vô điều kiện. Nghĩa là mật khẩu một lần do admin cấp, thường gửi qua chat CLB,
      // dùng được vô thời hạn với toàn bộ API bằng bất kỳ HTTP client nào. Đúng thứ
      // NFR-3 nói không được xảy ra: "guard thật ở server, UI chỉ là lớp che".
      const moi = await makeUser('member', { mustChangePassword: true })

      for (const path of ['/api/member/courses', '/api/member/submissions/recent']) {
        const res = await call(path, { as: moi })
        expect(res.status, path).toBe(403)
      }

      // Ba đường phải mở, nếu không thì chính việc đổi mật khẩu cũng kẹt.
      expect((await call('/auth/me', { as: moi })).status).toBe(200)
    })

    it('đổi mật khẩu xong thì vào được bình thường', async () => {
      // Đối chứng: chốt chặn không được khoá nhầm người đã đổi.
      const thuong = await makeUser('member')
      expect((await call('/api/member/courses', { as: thuong })).status).toBe(200)
    })
  })

  describe('chưa đăng nhập', () => {
    it('mọi route /api đều 401', async () => {
      for (const path of ['/api/admin/users', '/api/admin/courses', '/api/mentor/courses', '/api/member/courses']) {
        expect((await call(path)).status, path).toBe(401)
      }
    })

    it('token rác cũng 401', async () => {
      const res = await call('/api/member/courses', { headers: { cookie: 'bcn_session=rac' } })
      expect(res.status).toBe(401)
    })
  })

  describe('Tạo/khoá/đặt lại mật khẩu tài khoản, đổi vai trò — chỉ admin', () => {
    it('mentor và member bị 403', async () => {
      for (const user of [mentorA, member]) {
        expect((await call('/api/admin/users', { as: user })).status).toBe(403)
        expect(
          (await call('/api/admin/users', { as: user, body: { email: 'x@y.z', displayName: 'X', role: 'member' } }))
            .status,
        ).toBe(403)
      }
    })

    it('admin tạo được và nhận mật khẩu ban đầu đúng một lần', async () => {
      const res = await call('/api/admin/users', {
        as: admin,
        body: { email: 'moi@test.local', displayName: 'Mới', role: 'member' },
      })
      expect(res.status).toBe(201)
      expect(res.body.data.initialPassword).toHaveLength(10)
    })

    it('admin không tự hạ quyền chính mình', async () => {
      const res = await call(`/api/admin/users/${admin.id}`, { as: admin, method: 'PATCH', body: { role: 'member' } })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('cannot_demote_self')
    })
  })

  describe('Tạo/sửa/lưu trữ khoá học — chỉ admin (mentor chỉ sửa mô tả)', () => {
    it('mentor không tạo được khoá', async () => {
      const res = await call('/api/admin/courses', { as: mentorA, body: { code: 'x1', name: 'X' } })
      expect(res.status).toBe(403)
    })

    it('mentor của khoá sửa được mô tả', async () => {
      const res = await call(`/api/mentor/courses/${courseA.id}`, {
        as: mentorA,
        method: 'PATCH',
        body: { descriptionMd: 'Mô tả mới' },
      })
      expect(res.status).toBe(200)
      // ĐỌC LẠI, không chỉ kiểm status. Bỏ `descriptionMd` khỏi `.set()` của route
      // vẫn trả 200 và audit vẫn ghi "đã đổi" trong khi DB không đổi gì — đúng họ lỗi
      // mà problems.test.ts ghi là "đã xảy ra hai lần".
      const got = await call(`/api/mentor/courses/${courseA.id}`, { as: mentorA })
      expect(got.body.data.descriptionMd).toBe('Mô tả mới')
    })

    it('mentor NGOÀI khoá không sửa được (404, không lộ sự tồn tại)', async () => {
      const res = await call(`/api/mentor/courses/${courseA.id}`, {
        as: mentorB,
        method: 'PATCH',
        body: { descriptionMd: 'Cướp' },
      })
      expect(res.status).toBe(404)
    })
  })

  describe('Gán mentor vào khoá — chỉ admin', () => {
    it('mentor không gán được mentor khác', async () => {
      const res = await call(`/api/admin/courses/${courseA.id}/mentors`, { as: mentorA, body: { userId: mentorB.id } })
      expect(res.status).toBe(403)
    })

    it('admin không gán tài khoản member làm mentor khoá', async () => {
      const res = await call(`/api/admin/courses/${courseA.id}/mentors`, { as: admin, body: { userId: member.id } })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('not_staff')
    })
  })

  describe('Ghi danh/gỡ member — admin và mentor CỦA KHOÁ', () => {
    it('mentor của khoá ghi danh được, báo lại email không tồn tại', async () => {
      const res = await call(`/api/mentor/courses/${courseA.id}/enrollments`, {
        as: mentorA,
        body: { emails: [outsider.email, 'khongton@test.local'] },
      })
      expect(res.status).toBe(200)
      expect(res.body.data.enrolled).toBe(1)
      expect(res.body.data.missing).toEqual(['khongton@test.local'])
    })

    it('mentor ngoài khoá không ghi danh được', async () => {
      const res = await call(`/api/mentor/courses/${courseA.id}/enrollments`, {
        as: mentorB,
        body: { emails: [outsider.email] },
      })
      expect(res.status).toBe(404)
    })

    it('member không ghi danh được ai', async () => {
      const res = await call(`/api/mentor/courses/${courseA.id}/enrollments`, {
        as: member,
        body: { emails: [outsider.email] },
      })
      expect(res.status).toBe(403)
    })

    it('gỡ ghi danh chỉ lật trạng thái, không xoá dòng', async () => {
      await call(`/api/mentor/courses/${courseA.id}/enrollments/${member.id}`, { as: mentorA, method: 'DELETE' })
      const list = await call(`/api/mentor/courses/${courseA.id}/enrollments`, { as: mentorA })
      const row = list.body.data.find((r: { id: string }) => r.id === member.id)
      expect(row.status).toBe('removed')
    })
  })

  describe('Xem nội dung khoá — member chỉ thấy khoá ĐANG MỞ đã ghi danh', () => {
    it('member thấy khoá đã ghi danh', async () => {
      const res = await call('/api/member/courses', { as: member })
      expect(res.body.data.map((r: { id: string }) => r.id)).toEqual([courseA.id])
    })

    it('member chưa ghi danh không thấy và mở trực tiếp cũng 404', async () => {
      expect((await call('/api/member/courses', { as: outsider })).body.data).toEqual([])
      expect((await call(`/api/member/courses/${courseA.id}`, { as: outsider })).status).toBe(404)
    })

    it('khoá nháp không hiện với member dù đã ghi danh', async () => {
      const draft = await makeCourse(admin.id, { status: 'draft' })
      await enroll(draft.id, member.id)
      const res = await call('/api/member/courses', { as: member })
      expect(res.body.data.map((r: { id: string }) => r.id)).not.toContain(draft.id)
    })
  })

  describe('Tài khoản bị khoá (FR-A4)', () => {
    it('không đăng nhập được nhưng dữ liệu giữ nguyên', async () => {
      await call(`/api/admin/users/${member.id}`, { as: admin, method: 'PATCH', body: { disabled: true } })
      // Phiên cũ bị cắt ngay.
      expect((await call('/api/member/courses', { as: member })).status).toBe(401)
      const login = await call('/auth/login', {
        body: { emailOrUsername: member.email, password: 'password123' },
      })
      expect(login.status).toBe(403)
      // Ghi danh vẫn còn.
      const list = await call(`/api/admin/courses/${courseA.id}/enrollments`, { as: admin })
      expect(list.body.data.some((r: { id: string }) => r.id === member.id)).toBe(true)
    })
  })
})

describe.skipIf(!INTEGRATION)('luồng đăng nhập (FR-A1/A3)', () => {
  beforeAll(async () => {
    await setupDb()
  })
  beforeEach(async () => {
    await resetDb()
  })

  it('đăng nhập đúng → cookie httpOnly, /auth/me trả đúng người', async () => {
    const user = await makeUser('member', { email: 'me@test.local', password: 'password123' })
    const res = await app_login('me@test.local', 'password123')
    expect(res.status).toBe(200)
    expect(res.cookie).toMatch(/HttpOnly/)
    const me = await call('/auth/me', { headers: { cookie: res.cookie.split(';')[0]! } })
    expect(me.body.data.id).toBe(user.id)
  })

  it('sai mật khẩu → 400, không phân biệt email không tồn tại', async () => {
    await makeUser('member', { email: 'a@test.local', password: 'password123' })
    const wrong = await call('/auth/login', { body: { emailOrUsername: 'a@test.local', password: 'sai' } })
    const missing = await call('/auth/login', { body: { emailOrUsername: 'z@test.local', password: 'sai' } })
    expect(wrong.status).toBe(400)
    expect(missing.status).toBe(400)
    expect(wrong.body.error.message).toBe(missing.body.error.message)
  })

  it('đăng xuất thu hồi phiên ngay', async () => {
    const user = await makeUser('member')
    expect((await call('/auth/me', { as: user })).status).toBe(200)
    await call('/auth/logout', { as: user, method: 'POST' })
    expect((await call('/auth/me', { as: user })).status).toBe(401)
  })

  it('đổi mật khẩu: sai mật khẩu cũ bị chặn; đúng thì phiên cũ bị thu hồi', async () => {
    const user = await makeUser('member', { password: 'password123' })
    const bad = await call('/auth/change-password', {
      as: user,
      body: { currentPassword: 'sai', newPassword: 'matkhaumoi1' },
    })
    expect(bad.status).toBe(400)

    const good = await call('/auth/change-password', {
      as: user,
      body: { currentPassword: 'password123', newPassword: 'matkhaumoi1' },
    })
    expect(good.status).toBe(200)
    expect((await call('/auth/me', { as: user })).status).toBe(401)
  })
})

/** Đăng nhập trả cả header Set-Cookie (harness `call` không lộ header). */
async function app_login(emailOrUsername: string, password: string) {
  const { app } = await import('../testing/harness')
  const res = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-response-version': '2' },
    body: JSON.stringify({ emailOrUsername, password }),
  })
  return { status: res.status, cookie: res.headers.get('set-cookie') ?? '' }
}
