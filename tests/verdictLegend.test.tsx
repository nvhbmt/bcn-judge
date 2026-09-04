/**
 * Bảng "Ý nghĩa các verdict" ở panel Trợ giúp phải tô CÙNG MÀU với chip testcase.
 *
 * Bảng chú giải mà dùng bảng màu riêng thì nó chú giải cho chính nó: người đọc vừa
 * thấy một chip vàng ở kết quả chấm, sang trang trợ giúp gặp cùng verdict tô màu khác
 * là phải bắc cầu bằng chữ — mà màu mới là thứ họ nhớ.
 *
 * Test này KHÔNG chép tên token vào kỳ vọng (làm vậy chỉ là test tự soi chính nó).
 * Nó dựng CẢ HAI nơi rồi so giá trị đọc ra từ nơi này với nơi kia: chip đổi màu mà
 * bảng không đổi theo — hoặc ngược lại — là đỏ.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HelpPanel } from '@/pages/workspace/HelpPanel'
import { ResultTable } from '@/pages/workspace/ResultTable'
import type { ResultView, SubmissionView } from '@/types/api'
import { VERDICT_LABEL, type Verdict } from '@/types/api'

const VERDICTS = Object.keys(VERDICT_LABEL) as Verdict[]

/** Một lượt chấm có đủ bảy verdict, mỗi verdict một test — chỉ để lấy màu chip. */
function submission(): SubmissionView {
  const results: ResultView[] = VERDICTS.map((v, i) => ({
    position: i + 1,
    isSample: true,
    verdict: v,
    timeMs: 10,
    memoryKb: 1024,
    detail: null,
  }))
  return {
    id: 's1', kind: 'submit', problemId: 'p1', languageId: 'c11', status: 'done',
    verdict: 'WA', score: 0, passedWeight: 1, totalWeight: 7,
    timeMsMax: 10, memoryKbMax: 1024, compileOutput: null, results,
    receivedAt: '2026-09-04T10:00:00.000Z', finishedAt: '2026-09-04T10:00:01.000Z',
  } as SubmissionView
}

/** Màu chip của từng verdict, đọc từ chính ResultTable. Chip phải ĐANG CHỌN mới có
 *  nền — nền chỉ tô cho chip được chọn — nên bấm qua từng cái rồi mới đọc. */
function mauChip(): Record<string, { chu: string; vien: string; nen: string }> {
  const { unmount } = render(
    <ResultTable submission={submission()} samples={[]} compareMode="trim" emptyText="—" />,
  )
  const ra: Record<string, { chu: string; vien: string; nen: string }> = {}
  for (const v of VERDICTS) {
    const chip = screen.getByRole('tab', { name: new RegExp(`, ${VERDICT_LABEL[v]}$`) })
    fireEvent.click(chip)
    ra[v] = { chu: chip.style.color, vien: chip.style.borderColor, nen: chip.style.background }
  }
  unmount()
  return ra
}

describe('bảng chú giải verdict', () => {
  it('mỗi verdict là một hàng bảng, có mã gốc thành cột riêng', () => {
    render(<HelpPanel role="member" />)
    const bang = screen.getByRole('table')
    for (const v of VERDICTS) {
      const hang = within(bang).getByText(v).closest('tr')!
      // Ba ô: tag, mã, ý nghĩa — và ô ý nghĩa phải có chữ thật, không rỗng.
      expect(within(hang).getAllByRole('cell')).toHaveLength(3)
      expect(within(hang).getByText(VERDICT_LABEL[v])).toBeTruthy()
      expect(hang.textContent!.length).toBeGreaterThan(VERDICT_LABEL[v].length + v.length + 5)
    }
  })

  it('tag trong bảng tô đúng màu chip testcase — không phải bảng màu riêng', () => {
    const chip = mauChip()
    render(<HelpPanel role="member" />)
    const bang = screen.getByRole('table')
    for (const v of VERDICTS) {
      const tag = within(bang).getByText(VERDICT_LABEL[v])
      expect(tag.style.color, v).toBe(chip[v]!.chu)
      expect(tag.style.borderColor, v).toBe(chip[v]!.vien)
      expect(tag.style.background, v).toBe(chip[v]!.nen)
    }
  })

  it('bảy verdict không dùng chung một màu — bảng có phân biệt được thật', () => {
    // Canh chống ca "mọi ô cùng một biến": lúc đó test trên vẫn xanh mà bảng vô dụng.
    const chu = new Set(Object.values(mauChip()).map((m) => m.chu))
    expect(chu.size).toBeGreaterThanOrEqual(4)
  })
})
