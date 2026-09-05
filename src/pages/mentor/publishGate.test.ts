/** Cổng xuất bản mềm/cứng (FR-D6) + quirk LEFT JOIN của thống kê contest. */
import { describe, expect, it } from 'vitest'
import { ApiFailure } from '@/lib/api'
import { groupByProblem } from '@/pages/mentor/contest/contestStats'
import { readPublishGate } from './publishGate'

const conflict = (code: string) => new ApiFailure(409, { code, message: 'x' })

describe('readPublishGate', () => {
  it('cho xác nhận với đúng mã mềm publish_validation_failed', () => {
    expect(readPublishGate(conflict('publish_validation_failed')).canConfirm).toBe(true)
  })

  it('KHÔNG cho xác nhận với các cổng cứng — gửi lại confirm cũng vẫn 409', () => {
    for (const code of ['no_testcases', 'missing_expected', 'no_problems']) {
      expect(readPublishGate(conflict(code)).canConfirm).toBe(false)
    }
  })

  it('không nhầm 403/400 thành cổng mềm dù mã trùng tên', () => {
    expect(readPublishGate(new ApiFailure(403, { code: 'forbidden', message: 'x' })).canConfirm).toBe(false)
    // Cùng mã nhưng khác status thì không phải cổng của FR-D6.
    expect(readPublishGate(new ApiFailure(400, { code: 'publish_validation_failed', message: 'x' })).canConfirm).toBe(false)
  })

  it('lỗi không phải ApiFailure vẫn ra thông điệp đọc được, không cho xác nhận', () => {
    const gate = readPublishGate(new TypeError('boom'))
    expect(gate.canConfirm).toBe(false)
    expect(gate.message.length).toBeGreaterThan(0)
  })
})

describe('groupByProblem', () => {
  it('không tính hàng verdict null (bài chưa ai nộp) thành một lượt nộp', () => {
    const [row] = groupByProblem([{ contestProblemId: 'cp1', title: 'Bài A', verdict: null, n: 1 }])
    expect(row?.total).toBe(0)
    expect(row?.counts).toEqual([])
  })

  it('gom nhiều verdict của cùng một bài và đếm AC', () => {
    const [row] = groupByProblem([
      { contestProblemId: 'cp1', title: 'Bài A', verdict: 'WA', n: 3 },
      { contestProblemId: 'cp1', title: 'Bài A', verdict: 'AC', n: 5 },
    ])
    expect(row?.total).toBe(8)
    expect(row?.acCount).toBe(5)
    expect(row?.counts[0]?.verdict).toBe('AC')
  })
})
