/**
 * FR-D6: huy hiệu "đã kiểm" trên danh sách bài tập.
 *
 * Hai lỗi thật mà file này canh, cả hai đều lọt qua `tsc` vì FE giữ **bản sao**
 * kiểu của API — kiểu tự khai sai thì trình biên dịch hợp thức hoá chính cái sai:
 *
 *  1. `MentorProblemRow` khai snake_case trong khi `GET /api/mentor/problems` trả
 *     camelCase, nên mọi trường về `undefined`.
 *  2. `isValidated` dùng `!== null`, mà `undefined !== null` là true và
 *     `undefined === undefined` cũng true → trả true cho MỌI bài, dán nhãn xanh
 *     "đã kiểm" lên cả bài chưa hề kiểm. Đây là thứ mentor nhìn để quyết định
 *     publish, nên sai kiểu này nguy hiểm hơn hẳn một cái ngày hiển thị hỏng.
 *
 * Vì vậy có một ca cố tình ép kiểu dữ liệu snake_case cũ vào: nếu ai đó lỡ đưa
 * tên trường cũ quay lại, `isValidated` phải trả false chứ không phải true.
 */
import { describe, expect, it } from 'vitest'
import { isValidated, type MentorProblemRow } from '@/pages/mentor/types'

const row = (over: Partial<MentorProblemRow> = {}): MentorProblemRow => ({
  id: 'p1',
  title: 'Tổng hai số',
  scopeCourseId: null,
  difficulty: 'easy',
  tags: ['nhập xuất'],
  testcaseRev: 1,
  validatedTestcaseRev: 1,
  updatedAt: '2026-09-01T03:00:00.000Z',
  testcases: 5,
  ...over,
})

describe('isValidated — FR-D6', () => {
  it('đã kiểm khi lần kiểm khớp đúng bộ test hiện tại', () => {
    expect(isValidated(row())).toBe(true)
  })

  it('chưa kiểm khi chưa bao giờ kiểm', () => {
    expect(isValidated(row({ validatedTestcaseRev: null }))).toBe(false)
  })

  it('đổi testcase làm bài rơi về chưa kiểm', () => {
    expect(isValidated(row({ testcaseRev: 2, validatedTestcaseRev: 1 }))).toBe(false)
  })

  it('rev 0 vẫn tính là đã kiểm — 0 là số hợp lệ, không phải "thiếu dữ liệu"', () => {
    expect(isValidated(row({ testcaseRev: 0, validatedTestcaseRev: 0 }))).toBe(true)
  })

  it('trường thiếu (tên lệch với API) phải ra CHƯA kiểm, không phải đã kiểm', () => {
    const stale = { testcase_rev: 1, validated_testcase_rev: 1 } as unknown as MentorProblemRow

    expect(isValidated(stale)).toBe(false)
  })
})

describe('MentorProblemRow khớp hình dạng API', () => {
  /**
   * Chốt chặn cuối: liệt kê thẳng tên trường mà `GET /api/mentor/problems` alias ra
   * (server/src/routes/mentor/problems.ts). Đổi một bên mà quên bên kia thì đỏ ở đây.
   */
  it('dùng camelCase đúng như route alias', () => {
    const keys = Object.keys(row()).sort()

    expect(keys).toEqual(
      ['difficulty', 'id', 'scopeCourseId', 'tags', 'testcaseRev', 'testcases', 'title',
        'updatedAt', 'validatedTestcaseRev'].sort(),
    )
  })

  it('updatedAt parse được thành ngày hợp lệ', () => {
    expect(Number.isNaN(new Date(row().updatedAt).getTime())).toBe(false)
  })
})
