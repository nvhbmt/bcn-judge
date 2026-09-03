/**
 * Bảng lịch sử nộp bài (FR-E3/FR-G1).
 *
 * Bốn cột số liệu — ngôn ngữ, thời gian, bộ nhớ, điểm — đều dựng từ dữ liệu đã có sẵn
 * trong CÙNG một lượt gọi API danh sách. Trước đây panel chỉ hiện verdict, nên muốn so
 * "bản vừa rồi nhanh hơn bản trước bao nhiêu" thì phải bấm vào từng lượt.
 *
 * Hai thứ dễ hỏng lại và test canh riêng:
 *   - `c11` phải thành "C": mã ngôn ngữ là chuyện nội bộ, không phải thứ để đọc;
 *   - chưa chấm xong hoặc lỗi biên dịch thì ô ghi "—", KHÔNG ghi 0 — 0 ms là một phép
 *     đo, còn "không có số" là chuyện khác hẳn.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SubmissionsPanel } from '@/pages/workspace/SubmissionsPanel'
import type { LanguageOption, SubmissionView } from '@/types/api'

afterEach(() => vi.restoreAllMocks())

const LANGS: LanguageOption[] = [
  { id: 'c11', name: 'C', versionLabel: 'C11 · GCC 12', cmMode: 'c' },
  { id: 'python3', name: 'Python', versionLabel: '3.12', cmMode: 'python' },
]

function sub(over: Partial<SubmissionView>): SubmissionView {
  return {
    id: 's1', kind: 'submit', problemId: 'p1', languageId: 'c11', status: 'done',
    verdict: 'AC', score: 100, passedWeight: 3, totalWeight: 3,
    timeMsMax: 42, memoryKbMax: 46182, compileOutput: null,
    receivedAt: '2026-09-03T10:00:00.000Z', finishedAt: '2026-09-03T10:00:01.000Z',
    ...over,
  } as SubmissionView
}

function panel(rows: SubmissionView[]) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ success: true, data: rows, meta: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(
    <SubmissionsPanel
      handleQuery="itemId=i1"
      selectedId={null}
      languages={LANGS}
      onSelect={vi.fn()}
      onLoadIntoEditor={vi.fn()}
    />,
    { wrapper },
  )
}

const rowOf = async (text: RegExp) => {
  await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1))
  const found = screen.getAllByRole('row').find((r) => text.test(r.textContent ?? ''))
  if (!found) throw new Error(`Không có hàng nào khớp ${text}`)
  return found
}

describe('SubmissionsPanel', () => {
  it('hiện đủ thời gian, bộ nhớ và điểm — không phải chỉ mỗi verdict', async () => {
    panel([sub({})])
    const row = await rowOf(/Chấp nhận/)
    expect(within(row).getByText('42 ms')).toBeTruthy()
    expect(within(row).getByText('45.1 MB')).toBeTruthy()
    expect(within(row).getByText('100đ')).toBeTruthy()
  })

  it('đổi mã ngôn ngữ sang tên đọc được', async () => {
    panel([sub({ languageId: 'python3' })])
    const row = await rowOf(/Chấp nhận/)
    expect(within(row).getByText('Python')).toBeTruthy()
    expect(within(row).queryByText('python3')).toBeNull()
  })

  it('ngôn ngữ lạ thì hiện nguyên mã, không hiện rỗng', async () => {
    panel([sub({ languageId: 'rust1' })])
    expect(within(await rowOf(/Chấp nhận/)).getByText('rust1')).toBeTruthy()
  })

  it('chưa có số đo thì ghi "—", không ghi 0', async () => {
    panel([sub({ verdict: 'CE', score: null, timeMsMax: null, memoryKbMax: null })])
    const row = await rowOf(/Lỗi biên dịch/)
    expect(within(row).getAllByText('—')).toHaveLength(3)
    expect(within(row).queryByText('0 ms')).toBeNull()
  })

  it('dưới 1 MB thì giữ đơn vị KB — "0.0 MB" không nói gì', async () => {
    panel([sub({ memoryKbMax: 512 })])
    expect(within(await rowOf(/Chấp nhận/)).getByText('512 KB')).toBeTruthy()
  })

  it('bấm ở BẤT KỲ đâu trong hàng cũng chọn được lượt nộp đó', async () => {
    // Vùng bấm của nút chọn được kéo phủ kín hàng (`after:inset-0`) chứ không gắn
    // onClick lên <tr>: <tr> không nhận được tiêu điểm, nên cách kia là bỏ rơi bàn
    // phím và trình đọc màn hình để đổi lấy vùng bấm rộng hơn.
    //
    // jsdom không tính bố cục nên ở đây chỉ canh được ĐÚNG hai class dựng nên vùng
    // phủ. Phần "bấm thật vào ô giữa thì hàng được chọn" đã đo trên trình duyệt.
    panel([sub({})])
    const hang = await rowOf(/Chấp nhận/)
    const chon = within(hang).getByRole('button', { name: /Chấp nhận/ })
    expect(chon.className).toContain('after:inset-0')
    expect(hang.className).toContain('relative')
  })

  it('nút "Nạp lại code" nổi trên vùng phủ đó, không bị nuốt thành chọn hàng', async () => {
    panel([sub({})])
    const hang = await rowOf(/Chấp nhận/)
    const o = within(hang).getByRole('button', { name: 'Nạp lại code' }).closest('td')
    expect(o?.className).toContain('z-10')
    expect(o?.className).toContain('relative')
  })

  it('chưa nộp lần nào thì nói rõ, không hiện bảng rỗng', async () => {
    panel([])
    await waitFor(() => expect(screen.getByText('Chưa nộp bài nào')).toBeTruthy())
    expect(screen.queryByRole('table')).toBeNull()
  })
})
