/**
 * Bảng "ai thấy tab nào" của màn sửa khoá.
 *
 * Luật: **thấy tab nghĩa là sửa được trong đó**. Tab chỉ-đọc bị ẩn hẳn chứ không hiện
 * ra rồi khoá — một khung đầy nút bấm không được là lời mời thử rồi ăn 403, mà người
 * dùng không có cách nào biết đó là do vai của mình.
 *
 * Test này là bản sao của ma trận quyền ở server, nên nó bắt được đúng một lớp lỗi:
 * ai đó thêm tab mà quên rằng mentor không có quyền tương ứng. Ba dòng dễ nhầm nhất:
 *   - mentor GHI DANH được (`POST/DELETE /api/mentor/courses/:id/enrollments`);
 *   - mentor KHÔNG gán mentor được (route mentor chỉ có `GET /:id/mentors`);
 *   - giáo trình không phải tab — nó là panel phải, luôn hiện cho cả hai vai.
 */
import { describe, expect, it } from 'vitest'
import { resolveTab, tabsFor } from '@/pages/mentor/course/courseTabs'

const ids = (role: string | undefined) => tabsFor(role).map((t) => t.id)

describe('tabsFor', () => {
  it('admin thấy đủ ba tab', () => {
    expect(ids('admin')).toEqual(['thong-tin', 'ghi-danh', 'mentor'])
  })

  it('mentor KHÔNG thấy tab Mentor — chỉ đọc được thì ẩn', () => {
    expect(ids('mentor')).toEqual(['thong-tin', 'ghi-danh'])
  })

  it('mentor VẪN thấy tab Ghi danh — đây là chỗ dễ ẩn nhầm', () => {
    expect(ids('mentor')).toContain('ghi-danh')
  })

  it('giáo trình không phải tab của vai nào cả — nó là panel phải', () => {
    for (const role of ['admin', 'mentor', undefined]) {
      expect(ids(role)).not.toContain('giao-trinh')
    }
  })

  it('vai lạ hoặc chưa biết thì rơi về bộ tab hẹp nhất, không phải bộ của admin', () => {
    expect(ids(undefined)).toEqual(['thong-tin', 'ghi-danh'])
    expect(ids('member')).toEqual(['thong-tin', 'ghi-danh'])
  })
})

describe('resolveTab', () => {
  it('giữ nguyên tab hợp lệ', () => {
    expect(resolveTab('ghi-danh', tabsFor('admin'))).toBe('ghi-danh')
  })

  it('tab rác thì về tab đầu', () => {
    expect(resolveTab('khong-co-that', tabsFor('admin'))).toBe('thong-tin')
  })

  it('mentor gõ tay URL tab Mentor thì về tab đầu, không lọt vào khung không có quyền', () => {
    expect(resolveTab('mentor', tabsFor('mentor'))).toBe('thong-tin')
  })

  it('không có tab trong URL thì về tab đầu', () => {
    expect(resolveTab(undefined, tabsFor('admin'))).toBe('thong-tin')
  })
})
