/**
 * BXH các team ở cột phải màn /team.
 *
 * Hai điều được canh, cả hai đều là "bảng nói dối một nửa" nếu thiếu:
 *   - PHẠM VI phải hiện thành chữ. Cùng một bảng tên "BXH các team" mà lúc tính trong
 *     khoá, lúc tính toàn CLB thì hai con số không so được với nhau;
 *   - SỐ NGƯỜI phải hiện. Xếp theo TỔNG điểm nên team đông hơn thì tổng cao hơn —
 *     giấu số người đi là để người đọc tưởng đó là so sánh công bằng.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TeamStandings } from '@/pages/team/TeamStandings'

afterEach(() => vi.restoreAllMocks())

const hang = (over: Record<string, unknown> = {}) => ({
  rank: 1, id: 't1', name: 'Nhóm Alpha', acCount: 12, totalPoints: 1470, memberCount: 6, isMine: false, ...over,
})

function ve(data: unknown) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ success: true, data, meta: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(<TeamStandings />, { wrapper })
}

// Bảng KHÔNG còn <thead> (bản vẽ bỏ hàng tiêu đề cột), nên hàng đầu tiên đã là dữ
// liệu — không được canh theo "nhiều hơn 1 hàng" như hồi còn hàng tiêu đề nữa.
const dong = async (khop: RegExp) =>
  await waitFor(() => {
    const r = screen.getAllByRole('row').find((x) => khop.test(x.textContent ?? ''))
    if (!r) throw new Error(`không có hàng nào khớp ${khop}`)
    return r
  })

describe('BXH các team', () => {
  it('hiện hạng, tên, số bài AC và điểm', async () => {
    ve([hang()])
    const r = await dong(/Nhóm Alpha/)
    expect(within(r).getByText('12')).toBeInTheDocument()
    expect(within(r).getByText('1470')).toBeInTheDocument()
  })

  it('MỘT phạm vi duy nhất — không có nhãn "tính trong…" để phải đọc trước mỗi lần nhìn', async () => {
    ve([hang()])
    await dong(/Nhóm Alpha/)
    expect(screen.queryByText(/tính trong/)).not.toBeInTheDocument()
  })

  it('hiện số người mỗi team — xếp theo TỔNG nên đông hơn thì lợi hơn', async () => {
    ve([hang({ memberCount: 6 })])
    expect(within(await dong(/Nhóm Alpha/)).getByText('6 người')).toBeInTheDocument()
  })

  it('team của mình được đánh dấu', async () => {
    ve([hang(), hang({ rank: 2, id: 't2', name: 'Nhóm Beta', isMine: true })])
    const r = await dong(/Nhóm Beta/)
    // `--primary-soft` chứ KHÔNG phải `--surface-sel`: bản tối hai token trùng giá
    // trị nên đổi nhầm không lộ ra, còn bản sáng thì surface-sel là be trung tính
    // chroma 0 — dòng của mình mất hẳn màu. Xem chú thích --primary-soft ở colors.css.
    expect(r.className).toContain('primary-soft')
    expect((await dong(/Nhóm Alpha/)).className).not.toContain('primary-soft')
  })

  it('chưa có team nào thì nói rõ, không dựng bảng rỗng', async () => {
    ve([])
    await waitFor(() => expect(screen.getByText('Chưa có team nào để xếp hạng')).toBeInTheDocument())
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
