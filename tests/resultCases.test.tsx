/**
 * Kết quả chấm: dải chip từng test + chi tiết của đúng một test (FR-E5).
 *
 * Bản cũ liệt kê mọi test trong một bảng rồi mở bảng so NGAY DƯỚI mỗi test sai, nên sai
 * 5 test là 5 khối diff xếp chồng lặp lại y nguyên tiêu đề. Ba thứ được canh ở đây, đều
 * là chỗ dễ trôi ngược về bản cũ:
 *
 *   - đúng MỘT bảng so trên màn hình, dù sai bao nhiêu test;
 *   - mở sẵn test SAI đầu tiên — đó là câu hỏi người ta mở panel này để hỏi, mở test #1
 *     đang đạt thì bắt bấm thêm một nhịp mới tới chỗ cần xem;
 *   - dòng tổng kết lấy mốc CAO NHẤT cả lượt, không phải số của test đang xem — giới hạn
 *     chấm áp lên test nặng nhất.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ResultTable } from '@/pages/workspace/ResultTable'
import type { ResultView, SampleIO, SubmissionView } from '@/types/api'

const SAMPLES: SampleIO[] = [
  { position: 1, input: '1 5 3\n', expected: '9\n' },
  { position: 2, input: '2 4 6\n', expected: '12\n' },
]

const res = (r: Partial<ResultView> & { position: number }): ResultView => ({
  isSample: true,
  verdict: 'AC',
  timeMs: 4,
  memoryKb: 2048,
  detail: null,
  stdout: '9\n',
  ...r,
})

const sub = (results: ResultView[], over: Partial<SubmissionView> = {}): SubmissionView => ({
  id: 's1', kind: 'run', problemId: 'p1', languageId: 'c11', status: 'done',
  verdict: 'WA', score: 0, passedWeight: 0, totalWeight: 2,
  timeMsMax: 4, memoryKbMax: 2048, compileOutput: null,
  receivedAt: '2026-09-03T10:00:00.000Z', finishedAt: '2026-09-03T10:00:01.000Z',
  results,
  ...over,
})

const table = (submission: SubmissionView) =>
  render(<ResultTable submission={submission} samples={SAMPLES} compareMode="trim" emptyText="chưa chạy" />)

const chip = (n: number) => screen.getByRole('tab', { name: new RegExp(`^Test ${n},`) })

describe('dải chip testcase', () => {
  it('sai hai test vẫn chỉ MỘT bảng so trên màn hình', () => {
    table(sub([
      res({ position: 1, verdict: 'WA', stdout: '8\n' }),
      res({ position: 2, verdict: 'WA', stdout: '11\n' }),
    ]))
    expect(screen.getAllByRole('group', { name: /So output testcase mẫu/ })).toHaveLength(1)
  })

  it('mở sẵn test SAI đầu tiên, không phải test #1', () => {
    table(sub([
      res({ position: 1 }),
      res({ position: 2, verdict: 'WA', stdout: '11\n' }),
    ]))
    expect(chip(2)).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('group', { name: 'So output testcase mẫu #2' })).toBeInTheDocument()
  })

  it('bấm chip khác thì đổi chi tiết, không mở thêm khối thứ hai', async () => {
    table(sub([
      res({ position: 1, verdict: 'WA', stdout: '8\n' }),
      res({ position: 2, verdict: 'WA', stdout: '11\n' }),
    ]))
    await userEvent.click(chip(2))
    expect(screen.getByRole('group', { name: 'So output testcase mẫu #2' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'So output testcase mẫu #1' })).not.toBeInTheDocument()
  })

  it('đi được bằng mũi tên — dải này tự nhận là tablist thì phải giữ lời', async () => {
    table(sub([res({ position: 1 }), res({ position: 2, verdict: 'WA', stdout: '11\n' })]))
    chip(2).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(chip(1)).toHaveAttribute('aria-selected', 'true')
  })

  it('chip không chỉ dựa vào màu: có dấu ✓/✗ và nhãn đầy đủ', () => {
    table(sub([res({ position: 1 }), res({ position: 2, verdict: 'TLE', stdout: '' })]))
    expect(chip(1)).toHaveTextContent('✓ 1')
    expect(chip(2)).toHaveTextContent('✗ 2')
    expect(chip(2)).toHaveAccessibleName('Test 2, mẫu, Quá thời gian')
  })

  it('lượt chấm mới thì quay về mặc định, không giữ test của lượt cũ', async () => {
    const cu = [res({ position: 1, verdict: 'WA', stdout: '8\n' }), res({ position: 2, verdict: 'WA', stdout: '11\n' })]
    const { rerender } = table(sub(cu))
    await userEvent.click(chip(2))
    expect(chip(2)).toHaveAttribute('aria-selected', 'true')

    const moi = sub([res({ position: 1, verdict: 'WA', stdout: '7\n' }), res({ position: 2 })], { id: 's2' })
    rerender(<ResultTable submission={moi} samples={SAMPLES} compareMode="trim" emptyText="chưa chạy" />)
    expect(chip(1)).toHaveAttribute('aria-selected', 'true')
  })
})

describe('dòng tổng kết', () => {
  it('đếm số test đạt và lấy mốc CAO NHẤT cả lượt, không phải của test đang xem', () => {
    table(sub([
      res({ position: 1, timeMs: 4, memoryKb: 2048 }),
      res({ position: 2, verdict: 'WA', stdout: '11\n', timeMs: 91, memoryKb: 6144 }),
    ]))
    expect(screen.getByText('1/2 test đạt')).toBeInTheDocument()
    expect(screen.getByText(/cao nhất: 91 ms · 6\.0 MB/)).toBeInTheDocument()
  })

  it('chưa chấm xong thì nói đang chấm, không dán verdict tạm', () => {
    table(sub([res({ position: 1 })], { status: 'running', verdict: null }))
    expect(screen.getByText('Đang chấm…')).toBeInTheDocument()
  })
})

describe('test ẩn', () => {
  it('bấm vào thì nói rõ là ẩn, không lộ input lẫn đáp án', async () => {
    table(sub([
      res({ position: 1 }),
      { position: 2, isSample: false, verdict: 'WA', timeMs: 7, memoryKb: 2048, detail: null },
    ]))
    await userEvent.click(chip(2))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText(/Test ẩn — đề không công bố/)).toBeInTheDocument()
    expect(within(panel).queryByText('đáp án đúng')).not.toBeInTheDocument()
    // Số liệu vẫn có — đó là thứ duy nhất test ẩn được phép nói.
    expect(within(panel).getByText(/7 ms · 2\.0 MB/)).toBeInTheDocument()
  })
})
