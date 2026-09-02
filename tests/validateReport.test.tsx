/**
 * Báo cáo lượt kiểm bằng lời giải mẫu (FR-D6 / US-2).
 *
 * Chốt sự cố: báo cáo từng KHÔNG hiện diff. Nguyên nhân không nằm ở component mà ở
 * chỗ `useValidateRun` đọc kết quả qua `GET /api/member/submissions/:id` — serializer
 * member tước stdout/diff của testcase ẨN (NFR-2), mà bộ test sai thì thường sai ở
 * test ẩn. Server vẫn luôn có đường mentor trả `mentorStdout` cho MỌI testcase.
 *
 * Nên test quan trọng nhất ở đây là ca TEST ẨN sai: nó phải dựng được bảng so.
 */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ValidateReport } from '@/pages/mentor/ValidateReport'
import type { MentorTestcaseView, ValidateRunView } from '@/pages/mentor/types'

const TESTCASES: MentorTestcaseView[] = [
  { id: 't1', position: 1, kind: 'sample', weight: 1, inputPreview: '3\n', expectedPreview: '6\n', inputBytes: 2, expectedBytes: 2 },
  { id: 't2', position: 2, kind: 'hidden', weight: 1, inputPreview: '10\n', expectedPreview: '21\n', inputBytes: 3, expectedBytes: 3 },
]

function run(over: Partial<ValidateRunView> = {}): ValidateRunView {
  return {
    id: 'v1',
    status: 'done',
    verdict: 'WA',
    compileOutput: null,
    results: [
      { position: 1, isSample: true, verdict: 'AC', timeMs: 5, memoryKb: 2048, exitCode: 0, termSignal: null, detail: null, stdout: '6\n', stderr: null, mentorStdout: '6\n', firstDiffLine: null },
      { position: 2, isSample: false, verdict: 'WA', timeMs: 6, memoryKb: 2048, exitCode: 0, termSignal: null, detail: null, stdout: null, stderr: null, mentorStdout: '20\n', firstDiffLine: 1 },
    ],
    ...over,
  }
}

const view = (r = run()) =>
  render(<ValidateReport result={r} testcases={TESTCASES} compareMode="trim" />)

describe('ValidateReport', () => {
  it('dựng bảng so cho testcase ẨN sai — đúng ca mà đường member không trả diff', () => {
    view()
    const diff = screen.getByRole('group', { name: /So output testcase mẫu #2/ })
    // Cột trái là output lời giải mẫu, cột phải là expected trong bộ test. Gọi ngược
    // ("đáp án đúng") thì sai hẳn ý: mentor mở bảng này chính vì nghi cột phải sai.
    expect(within(diff).getByText('lời giải mẫu in ra')).toBeTruthy()
    expect(within(diff).getByText('expected trong bộ test')).toBeTruthy()
  })

  it('nêu số testcase hỏng và liệt kê verdict của mọi testcase', () => {
    view()
    expect(screen.getByText(/1\/2 testcase KHÔNG khớp/)).toBeTruthy()
    const strip = screen.getByRole('list', { name: 'Kết quả từng testcase' })
    expect(within(strip).getAllByRole('listitem')).toHaveLength(2)
  })

  it('bộ test khớp hết thì nói thẳng là dùng được, không dựng bảng so nào', () => {
    const ok = run({
      verdict: 'AC',
      results: run().results.map((r) => ({ ...r, verdict: 'AC' as const, mentorStdout: '6\n' })),
    })
    view(ok)
    expect(screen.getByText(/2\/2 testcase khớp lời giải mẫu/)).toBeTruthy()
    expect(screen.queryByRole('group', { name: /So output/ })).toBeNull()
  })

  it('lời giải mẫu không biên dịch được thì hiện log, không hiện bảng testcase', () => {
    view(run({ compileOutput: 'solution.c:3: error: expected ‘;’' }))
    expect(screen.getByText(/không biên dịch được/)).toBeTruthy()
    expect(screen.getByText(/solution.c:3/)).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Kết quả từng testcase' })).toBeNull()
  })

  it('TLE thì KHÔNG đặt output cạnh expected — output dở dang không phải "sai đáp án"', () => {
    const tle = run({
      results: [
        { position: 1, isSample: true, verdict: 'TLE', timeMs: 1000, memoryKb: 2048, exitCode: null, termSignal: 9, detail: 'quá 1000 ms', stdout: null, stderr: null, mentorStdout: '', firstDiffLine: null },
      ],
    })
    view(tle)
    expect(screen.queryByRole('group', { name: /So output/ })).toBeNull()
    expect(screen.getByText(/quá 1000 ms/)).toBeTruthy()
  })
})
