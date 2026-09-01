import { describe, expect, it } from 'vitest'
import { compareOutput } from './compare'
import { decideVerdict, overallVerdict } from './verdict'
import type { JudgeMeta } from './types'

describe('compareOutput', () => {
  it('trim: bỏ qua khoảng trắng cuối dòng và dòng trống cuối', () => {
    expect(compareOutput('8\n', '8').ok).toBe(true)
    expect(compareOutput('8  \n\n\n', '8\n').ok).toBe(true)
    expect(compareOutput('1 2\n3 4\n', '1 2\n3 4\n').ok).toBe(true)
  })

  it('trim: chuẩn hoá CRLF/CR (FR-D5 v0.5)', () => {
    expect(compareOutput('8\r\n', '8\n').ok).toBe(true)
    expect(compareOutput('a\rb\r', 'a\nb\n').ok).toBe(true)
  })

  it('trim: báo đúng dòng khác biệt đầu tiên', () => {
    const cmp = compareOutput('1\n9\n3\n', '1\n2\n3\n')
    expect(cmp.ok).toBe(false)
    expect(cmp.firstDiffLine).toBe(2)
  })

  it('exact: khoảng trắng cuối dòng là khác biệt', () => {
    expect(compareOutput('8 \n', '8\n', 'exact').ok).toBe(false)
    expect(compareOutput('8\n', '8\n', 'exact').ok).toBe(true)
  })

  it('float: so số thực theo sai số', () => {
    expect(compareOutput('3.1415926', '3.1415927', 'float', 1e-6).ok).toBe(true)
    expect(compareOutput('3.14', '3.15', 'float', 1e-6).ok).toBe(false)
    expect(compareOutput('1.0 2.0', '1.0 2.0 3.0', 'float').ok).toBe(false)
  })
})

const meta = (over: Partial<JudgeMeta> = {}): JudgeMeta => ({
  st: 0,
  wall: 0.1,
  cpu: 0.05,
  rssKb: 2048,
  oom: 0,
  pids: 3,
  bset: 1,
  ...over,
})

const base = {
  stdout: Buffer.from('8\n'),
  expected: Buffer.from('8\n'),
  outputTruncated: false,
  effectiveTimeLimitSec: 1,
  memoryLimitKb: 256 * 1024,
  compareMode: 'trim' as const,
}

describe('decideVerdict — bảng §3.4 xét đúng thứ tự', () => {
  it('không có meta → IE', () => {
    expect(decideVerdict({ ...base, meta: null }).verdict).toBe('IE')
  })

  it('lỗi hệ thống thắng mọi thứ khác → IE', () => {
    expect(decideVerdict({ ...base, meta: meta(), systemError: 'exec_failed' }).verdict).toBe('IE')
  })

  it('oom → MLE, ưu tiên trên TLE', () => {
    const r = decideVerdict({ ...base, meta: meta({ oom: 1, cpu: 5, st: 137 }) })
    expect(r.verdict).toBe('MLE')
  })

  it('maxrss vượt trần → MLE', () => {
    expect(decideVerdict({ ...base, meta: meta({ rssKb: 300 * 1024 }) }).verdict).toBe('MLE')
  })

  it('cpu chạm trần → TLE', () => {
    expect(decideVerdict({ ...base, meta: meta({ cpu: 1.2, st: 137 }) }).verdict).toBe('TLE')
  })

  it('bị kill ở wall (sleep vô hạn, cpu thấp) → TLE', () => {
    expect(decideVerdict({ ...base, meta: meta({ cpu: 0.01, st: 137 }) }).verdict).toBe('TLE')
  })

  it('output tràn → RE(output_limit), KHÔNG phải TLE dù bị worker SIGKILL', () => {
    const r = decideVerdict({ ...base, meta: meta({ st: 137, cpu: 0.2 }), outputTruncated: true })
    expect(r.verdict).toBe('RE')
    expect(r.detail).toBe('output_limit')
  })

  it('exit khác 0 → RE kèm mã thoát', () => {
    const r = decideVerdict({ ...base, meta: meta({ st: 3 }) })
    expect(r.verdict).toBe('RE')
    expect(r.detail).toBe('exit_3')
    expect(r.exitCode).toBe(3)
  })

  it('signal → RE kèm tên signal', () => {
    const r = decideVerdict({ ...base, meta: meta({ st: 139 }) })
    expect(r.verdict).toBe('RE')
    expect(r.detail).toBe('SIGSEGV')
    expect(r.termSignal).toBe(11)
  })

  it('output lệch → WA kèm dòng khác biệt', () => {
    const r = decideVerdict({ ...base, meta: meta(), stdout: Buffer.from('9\n') })
    expect(r.verdict).toBe('WA')
    expect(r.firstDiffLine).toBe(1)
  })

  it('khớp → AC', () => {
    expect(decideVerdict({ ...base, meta: meta() }).verdict).toBe('AC')
  })
})

describe('overallVerdict (FR-F2)', () => {
  it('mọi test AC → AC', () => {
    expect(overallVerdict([
      { position: 1, verdict: 'AC' },
      { position: 2, verdict: 'AC' },
    ])).toBe('AC')
  })

  it('lấy verdict của testcase lỗi đầu tiên theo position', () => {
    expect(overallVerdict([
      { position: 3, verdict: 'TLE' },
      { position: 1, verdict: 'AC' },
      { position: 2, verdict: 'WA' },
    ])).toBe('WA')
  })

  it('IE ở bất kỳ đâu → IE (requeue, không trừ lượt member)', () => {
    expect(overallVerdict([
      { position: 1, verdict: 'WA' },
      { position: 2, verdict: 'IE' },
    ])).toBe('IE')
  })

  it('không có testcase nào → IE, KHÔNG phải AC', () => {
    // Nhánh rỗng chưa từng được kiểm. Đổi `return 'IE'` thành `return 'AC'` thì cả
    // 209 test vẫn xanh — mà nghĩa của nó là bài chưa có testcase nào cho AC trọn
    // điểm cho mọi người nộp.
    expect(overallVerdict([])).toBe('IE')
  })
})
