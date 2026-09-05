/**
 * Bảng điều khiển dưới editor — ba tab, ba câu hỏi khác nhau (FR-E5).
 *
 * Hai điều được canh ở đây:
 *   - tab "stdin tự nhập" tự đủ: gõ, bấm chạy, đọc output, không phải rời tab;
 *   - hai loại lượt chạy KHÔNG lẫn sang nhau. Chạy testcase mẫu rồi mở tab stdin mà
 *     thấy output của lượt đó thì người dùng đang đọc kết quả của một cú bấm khác.
 */
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { VERDICT_LABEL } from '@/types/api'
import { ConsolePanel } from '@/pages/workspace/ConsolePanel'
import type { ResultView, SampleIO, SubmissionView } from '@/types/api'

const SAMPLES: SampleIO[] = [{ position: 1, input: '3 5\n', expected: '15\n' }]

const run = (results: Partial<ResultView>[]): SubmissionView => ({
  id: 's1',
  kind: 'run',
  problemId: 'p1',
  languageId: 'c11',
  status: 'done',
  verdict: 'AC',
  score: null,
  passedWeight: null,
  totalWeight: null,
  timeMsMax: 12,
  memoryKbMax: 2048,
  compileOutput: null,
  receivedAt: '2026-09-01T10:00:00.000Z',
  finishedAt: '2026-09-01T10:00:01.000Z',
  results: results.map((r, i) => ({
    position: i + 1,
    isSample: true,
    verdict: 'AC',
    timeMs: 12,
    memoryKb: 2048,
    detail: null,
    ...r,
  })) as ResultView[],
})

function panel(over: Partial<Parameters<typeof ConsolePanel>[0]> = {}) {
  const props = {
    tab: 'stdin' as const,
    onTab: vi.fn(),
    customInput: '3 5\n',
    onCustomInput: vi.fn(),
    onRunCustom: vi.fn(),
    busy: null,
    sampleRun: null,
    customRun: null,
    customRunPending: false,
    submission: null,
    samples: SAMPLES,
    compareMode: 'trim',
    ...over,
  }
  render(<ConsolePanel {...props} />)
  return props
}

describe('tab stdin tự nhập — gõ, chạy, đọc tại chỗ', () => {
  it('có nút chạy riêng, bấm là gọi lượt chạy với input tự nhập', async () => {
    const props = panel()
    await userEvent.click(screen.getByRole('button', { name: /Chạy với input này/ }))
    expect(props.onRunCustom).toHaveBeenCalledOnce()
  })

  it('output của lượt tự nhập hiện ngay trong tab, không phải đổi sang tab khác', () => {
    panel({ customRun: run([{ stdout: '15\n' }]) })
    expect(screen.getByText('stdout')).toBeInTheDocument()
    expect(screen.getByText(/^15/)).toBeInTheDocument()
  })

  it('chạy testcase mẫu thì tab stdin KHÔNG mượn kết quả đó', () => {
    panel({ sampleRun: run([{ stdout: 'output lượt mẫu' }]) })
    expect(screen.queryByText('output lượt mẫu')).not.toBeInTheDocument()
    expect(screen.getByText(/output hiện ở đây sau khi bấm Chạy/)).toBeInTheDocument()
  })

  it('ngược lại, tab chạy thử không mượn kết quả của lượt tự nhập', () => {
    panel({ tab: 'chay-thu', customRun: run([{ stdout: 'x' }]) })
    expect(screen.getByText('Chưa chạy thử lần nào.')).toBeInTheDocument()
  })

  it('chạy stdin KHÔNG xoá bảng kết quả testcase mẫu đang xem dở', () => {
    // Hai lượt chạy được theo dõi riêng, nên tab nào vẫn giữ kết quả của tab đó.
    const props = { sampleRun: run([{ verdict: 'WA' as const, stdout: '16\n' }]), customRun: run([{ stdout: 'ba ba ba' }]) }
    panel({ tab: 'stdin', ...props })
    expect(screen.getByText('ba ba ba')).toBeInTheDocument()

    cleanup()
    panel({ tab: 'chay-thu', ...props })
    expect(screen.getByRole('group', { name: 'So output testcase mẫu #1' })).toBeInTheDocument()
    expect(screen.queryByText('ba ba ba')).not.toBeInTheDocument()
  })

  // Bám vào VERDICT_LABEL chứ không chép cứng chữ: huy hiệu hiện TÊN tiếng Việt
  // ("Chấp nhận", "Quá thời gian"), mã gốc lùi về tooltip. Đổi cách gọi verdict là
  // việc của sản phẩm, không nên làm đỏ những test canh chuyện khác.
  it('ô nhập lấy input mẫu làm placeholder — ô trống không nói được định dạng', () => {
    panel()
    // Đây là thứ người ta gõ sai nhiều nhất: ba số một dòng hay mỗi số một dòng?
    // Mẫu thật trả lời ngay, và nó vốn đã in trong đề nên không lộ gì thêm.
    expect(screen.getByLabelText(/Chương trình đọc đúng/)).toHaveAttribute(
      'placeholder',
      expect.stringContaining(SAMPLES[0]!.input.trim()),
    )
  })

  it('bài chưa có testcase mẫu thì rơi về câu chung, không để ô trống trơn', () => {
    panel({ samples: [] })
    const box = screen.getByLabelText(/Chương trình đọc đúng/)
    expect(box.getAttribute('placeholder')).toMatch(/đúng định dạng đề mô tả/)
  })

  it('lượt tự nhập không có đáp án để so, nên không dán nhãn AC', () => {
    panel({ customRun: run([{ stdout: '15\n', verdict: 'AC' }]) })
    expect(screen.queryByText(VERDICT_LABEL.AC)).not.toBeInTheDocument()
  })

  it('nhưng TLE thì vẫn phải hiện — đó là tin thật về lượt chạy', () => {
    panel({ customRun: run([{ stdout: '', verdict: 'TLE' }]) })
    expect(screen.getByText(VERDICT_LABEL.TLE)).toBeInTheDocument()
  })

  it('vừa bấm xong, kết quả chưa về: vẫn là "đang chạy", không quay lại lời mời bấm', () => {
    panel({ customRunPending: true })
    expect(screen.getByText('đang chạy…')).toBeInTheDocument()
    expect(screen.queryByText(/output hiện ở đây sau khi bấm Chạy/)).not.toBeInTheDocument()
  })

  it('stderr hiện tách khỏi stdout', () => {
    panel({ customRun: run([{ stdout: 'a', stderr: 'segfault ở dòng 4' }]) })
    expect(screen.getByText('segfault ở dòng 4')).toBeInTheDocument()
  })
})

describe('testcase mẫu sai — bảng so output', () => {
  const wa = { tab: 'chay-thu' as const, sampleRun: run([{ verdict: 'WA' as const, stdout: '16\n' }]) }

  it('đặt output của mình cạnh đáp án đúng và nói lệch từ dòng nào', () => {
    panel(wa)
    expect(screen.getByText('output của bạn')).toBeInTheDocument()
    expect(screen.getByText('đáp án đúng')).toBeInTheDocument()
    expect(screen.getByText('khác từ dòng 1')).toBeInTheDocument()
  })

  it('input của testcase hiện kèm, lấy từ đề chứ không phải từ kết quả chấm', () => {
    panel(wa)
    expect(screen.getByText('input')).toBeInTheDocument()
    expect(screen.getByText('3 5')).toBeInTheDocument()
  })

  it('tô đúng ký tự lệch chứ không tô cả dòng', () => {
    panel(wa)
    // '16' vs '15': phần chung '1' nằm ngoài, chỉ '6' và '5' được đánh dấu.
    const marks = screen.getAllByRole('mark').map((m) => m.textContent)
    expect(marks).toEqual(['6', '5'])
  })

  it('khác biệt vô hình được nói thành lời, không để người học tự dò', () => {
    // Dấu cách thừa cuối dòng chỉ gây WA ở chế độ `exact` — ở `trim` máy chấm đã rstrip.
    panel({ tab: 'chay-thu', compareMode: 'exact', sampleRun: run([{ verdict: 'WA', stdout: '15 \n' }]) })
    expect(screen.getByText('chỉ khác ở khoảng trắng')).toBeInTheDocument()
    // Và dấu cách thừa được hiện thành ký hiệu nhìn thấy được.
    expect(screen.getByRole('mark')).toHaveTextContent('␣')
  })

  it('ở chế độ trim, diff bỏ qua đúng những gì máy chấm bỏ qua', () => {
    // Thừa dấu cách ở dòng 1 (máy chấm không tính) và sai số thật ở dòng 2. Bảng phải
    // chỉ vào dòng 2 — chỉ vào dòng 1 là đẩy người học đi soi chỗ không có lỗi.
    panel({
      tab: 'chay-thu',
      samples: [{ position: 1, input: '3 5\n', expected: '15\n7\n' }],
      sampleRun: run([{ verdict: 'WA', stdout: '15   \n9\n' }]),
    })
    expect(screen.getByText('khác từ dòng 2')).toBeInTheDocument()
    expect(screen.getByText('output của bạn')).toBeInTheDocument()
  })

  it('testcase ẩn không có gì để so — và cũng không được lộ đáp án', () => {
    panel({
      tab: 'chay-thu',
      sampleRun: run([{ position: 1, isSample: false, verdict: 'WA' }]),
    })
    expect(screen.queryByText('đáp án đúng')).not.toBeInTheDocument()
    expect(screen.queryByText('15')).not.toBeInTheDocument()
  })

  it('AC thì không mở bảng so làm gì', () => {
    panel({ tab: 'chay-thu', sampleRun: run([{ verdict: 'AC', stdout: '15\n' }]) })
    expect(screen.queryByText('đáp án đúng')).not.toBeInTheDocument()
  })

  it('lỗi biên dịch (verdict CE) thì báo lỗi, không dựng bảng so', () => {
    const s = run([])
    panel({ tab: 'chay-thu', sampleRun: { ...s, verdict: 'CE', compileOutput: 'error: expected ;' } })
    expect(within(screen.getByText('Lỗi biên dịch').parentElement!).getByText(/expected ;/)).toBeInTheDocument()
    expect(screen.queryByText('đáp án đúng')).not.toBeInTheDocument()
  })

  it('CẢNH BÁO (verdict không phải CE) không bị gọi là lỗi — bài vẫn được chấm', () => {
    // Thiếu header trong C ra cảnh báo implicit-declaration nhưng exit 0 → verdict
    // vẫn là kết quả chấm thật; compileOutput chứa cảnh báo không được dán "Lỗi".
    const s = run([{ verdict: 'AC', stdout: '10\n' }])
    panel({ tab: 'chay-thu', sampleRun: { ...s, verdict: 'AC', compileOutput: 'warning: implicit declaration' } })
    expect(screen.queryByText('Lỗi biên dịch')).not.toBeInTheDocument()
    expect(screen.getByText(/Cảnh báo/)).toBeInTheDocument()
  })
})
