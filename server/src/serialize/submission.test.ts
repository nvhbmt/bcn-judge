/**
 * Hai dẫn xuất mà API trả thẳng cho người dùng, và cả hai trước đây chỉ được kiểm
 * ở các giá trị SUY BIẾN — nên chúng vẫn "xanh" khi công thức sai.
 *
 * `scoreOf`: qua DB+API chỉ có 0 và 100 được khẳng định. Bỏ làm tròn 2 chữ số thì
 * 209 test vẫn xanh, trong khi mọi người học thấy 67 thay vì 66,67.
 *
 * `toLeaderSubmission`: chỉ nhánh "contest ĐANG diễn ra" có test. Khoá source vĩnh
 * viễn (`embargoed = contestEndsAt !== null`) cũng qua sạch — FR-J3 chết lặng.
 */
import { describe, expect, it } from 'vitest'
import { scoreOf, toLeaderSubmission, type RawSubmissionRow } from './submission'

describe('scoreOf (FR-F2 v0.5)', () => {
  it('làm tròn 2 chữ số, không làm tròn về số nguyên', () => {
    expect(scoreOf(2, 3)).toBe(66.67)
    expect(scoreOf(1, 3)).toBe(33.33)
  })

  it('theo TRỌNG SỐ chứ không theo số testcase', () => {
    // 2 test đúng trong 3, nhưng trọng số 1+3 trên tổng 1+3+6.
    expect(scoreOf(4, 10)).toBe(40)
  })

  it('hai đầu mút và ca không có gì để chia', () => {
    expect(scoreOf(0, 3)).toBe(0)
    expect(scoreOf(3, 3)).toBe(100)
    expect(scoreOf(null, 3)).toBeNull()
    expect(scoreOf(0, 0)).toBeNull()
  })
})

const ROW: RawSubmissionRow = {
  id: 's1',
  kind: 'submit',
  userId: 'u1',
  problemId: 'p1',
  itemId: null,
  contestId: 'c1',
  contestProblemId: 'cp1',
  languageId: 'c11',
  source: 'int main(void){return 0;}',
  sourceBytes: 25,
  status: 'done',
  verdict: 'AC',
  passedWeight: 3,
  totalWeight: 3,
  timeMsMax: 12,
  memoryKbMax: 1600,
  compileOutput: null,
  receivedAt: '2026-09-01T00:00:00.000Z',
  finishedAt: '2026-09-01T00:00:01.000Z',
  queuedMs: 10,
  judgeMs: 900,
  attempt: 1,
}

describe('toLeaderSubmission — cấm xem source trong contest (FR-J3)', () => {
  const KET_THUC = new Date('2026-09-01T10:00:00.000Z')

  it('contest đang diễn ra: leader KHÔNG xem được source', () => {
    const v = toLeaderSubmission(ROW, {
      contestEndsAt: KET_THUC,
      now: new Date('2026-09-01T09:00:00.000Z'),
    })
    expect(v.source).toBeNull()
    expect(v.sourceEmbargoedUntil).toBe(KET_THUC.toISOString())
  })

  it('contest ĐÃ KẾT THÚC: mở lại source, và mốc cấm biến mất', () => {
    // Nhánh này chưa từng có ca nào. Khoá vĩnh viễn thì cả bộ test vẫn xanh.
    const v = toLeaderSubmission(ROW, {
      contestEndsAt: KET_THUC,
      now: new Date('2026-09-01T10:00:01.000Z'),
    })
    expect(v.source).toBe(ROW.source)
    expect(v.sourceEmbargoedUntil).toBeNull()
  })

  it('bài ngoài contest: không có gì để cấm', () => {
    const v = toLeaderSubmission(ROW, { contestEndsAt: null })
    expect(v.source).toBe(ROW.source)
    expect(v.sourceEmbargoedUntil).toBeNull()
  })
})
