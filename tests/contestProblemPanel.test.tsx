/**
 * Khung "Bài trong contest" của trang sửa contest (FR-I2).
 *
 * Chốt sự cố: khung này từng LUÔN mở ra rỗng. Server vẫn luôn có
 * `GET /api/mentor/contests/:id` trả kèm danh sách bài, nhưng SPA chú thích nhầm là
 * route đó không tồn tại và đi vòng qua danh sách contest (không có bài). Vì
 * `PUT /:id/problems` THAY THẾ cả bộ, hệ quả là mở form rồi bấm lưu sẽ gỡ sạch bài —
 * mất luôn thứ tự, nhãn và điểm tối đa.
 *
 * Nên hai test đầu canh đúng điều đó: khung phải khởi đầu bằng bài ĐANG có, và lưu mà
 * không sửa gì thì trả lại nguyên vẹn bộ cũ.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ContestProblemPanel } from '@/pages/mentor/ContestProblemPanel'
import type { ContestProblemDraft } from '@/pages/mentor/mentorTypes'

const INITIAL: ContestProblemDraft[] = [
  { problemId: 'p1', title: 'Bài 1: Bắt đầu của một lập trình viên', label: '1', maxScore: '100' },
  { problemId: 'p2', title: 'Bài 2: Câu chuyện chiếc bánh lót', label: '2', maxScore: '100' },
  { problemId: 'p3', title: 'Bài 3: Cái máy pha cà phê kỳ cục', label: '3', maxScore: '150' },
]

function renderPanel(initial = INITIAL, lockedIds: string[] = []) {
  const onSave = vi.fn()
  render(
    <MemoryRouter>
      <ContestProblemPanel bank={[]} initial={initial} lockedIds={lockedIds} pending={false} onSave={onSave} />
    </MemoryRouter>,
  )
  return { onSave }
}

const saveButton = () => screen.getByRole('button', { name: /Lưu \d+ bài/ })
/** Mỗi bài là MỘT hàng sửa được tại chỗ, nên thao tác phải khoanh trong đúng hàng. */
function row(title: RegExp): HTMLElement {
  const found = screen.getAllByRole('listitem').find((li) => title.test(li.textContent ?? ''))
  if (!found) throw new Error(`Không có hàng nào khớp ${title}`)
  return found
}

describe('ContestProblemPanel', () => {
  it('mở ra đã có sẵn bài hiện tại của contest, không phải khung rỗng', () => {
    renderPanel()
    expect(screen.queryByText('Chưa chọn bài nào')).toBeNull()
    const list = screen.getByRole('list', { name: 'Bài trong contest' })
    for (const d of INITIAL) expect(within(list).getByText(d.title)).toBeTruthy()
  })

  it('mỗi bài một hàng, sửa được ngay tại hàng đó — không phải bấm chọn rồi kéo mắt xuống', () => {
    renderPanel()
    const r = row(/Câu chuyện chiếc bánh lót/)
    expect(within(r).getByLabelText(/^Nhãn của bài/)).toBeTruthy()
    expect(within(r).getByLabelText(/^Điểm tối đa của bài/)).toBeTruthy()
    expect(within(r).getByRole('button', { name: 'Đưa lên trên' })).toBeTruthy()
    expect(within(r).getByRole('button', { name: 'Đưa xuống dưới' })).toBeTruthy()
    expect(within(r).getByRole('button', { name: 'Gỡ khỏi contest' })).toBeTruthy()
    expect(within(r).getByRole('link', { name: /Sửa nội dung bài/ })).toBeTruthy()
  })

  it('lưu mà không sửa gì thì trả lại đúng bộ cũ — nhãn và điểm giữ nguyên', async () => {
    const { onSave } = renderPanel()
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith([
      { problemId: 'p1', label: '1', maxScore: 100 },
      { problemId: 'p2', label: '2', maxScore: 100 },
      { problemId: 'p3', label: '3', maxScore: 150 },
    ])
  })

  it('sửa điểm ngay trên hàng của bài đó, không đụng bài khác', async () => {
    const { onSave } = renderPanel()
    const score = within(row(/Câu chuyện chiếc bánh lót/)).getByLabelText(/^Điểm tối đa của bài/)
    await userEvent.clear(score)
    await userEvent.type(score, '250')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith([
      { problemId: 'p1', label: '1', maxScore: 100 },
      { problemId: 'p2', label: '2', maxScore: 250 },
      { problemId: 'p3', label: '3', maxScore: 150 },
    ])
  })

  it('đưa bài lên trên thì thứ tự gửi đi đổi theo — thứ tự mảng chính là position', async () => {
    const { onSave } = renderPanel()
    await userEvent.click(within(row(/Cái máy pha cà phê/)).getByRole('button', { name: 'Đưa lên trên' }))
    await userEvent.click(saveButton())
    expect(onSave.mock.calls[0]![0].map((p: { problemId: string }) => p.problemId)).toEqual(['p1', 'p3', 'p2'])
  })

  it('bài đã có người nộp thì không cho gỡ — server sẽ từ chối', () => {
    renderPanel(INITIAL, ['p1'])
    const locked = within(row(/Bắt đầu của một lập trình viên/)).getByRole('button', {
      name: /không gỡ được/,
    })
    expect(locked).toHaveProperty('disabled', true)
    // Bài khác vẫn gỡ được bình thường.
    expect(
      within(row(/Câu chuyện chiếc bánh lót/)).getByRole('button', { name: 'Gỡ khỏi contest' }),
    ).toHaveProperty('disabled', false)
  })

  it('contest chưa có bài nào thì vẫn là khung rỗng', () => {
    renderPanel([])
    expect(screen.getByText('Chưa chọn bài nào')).toBeTruthy()
  })
})
