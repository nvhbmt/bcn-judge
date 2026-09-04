/**
 * Bảng xếp hạng contest — hạng · tên · đã giải · điểm.
 *
 * Bản trước dựng MỘT CỘT CHO MỖI BÀI. Trong `SideColumn` hẹp của màn contest, 10 bài
 * là 10 cột chen vào và cột tên bị bóp còn "Phạ…" — bảng xếp hạng mà không đọc được
 * tên ai thì không còn là bảng xếp hạng. Test số cột ở đây chốt đúng điều đó: thêm
 * bài KHÔNG được làm bảng rộng thêm.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContestStandings } from '@/pages/contest/ContestStandings'
import type { ContestStandingRow } from '@/pages/contest/standings'

afterEach(() => vi.restoreAllMocks())

const BAI = Array.from({ length: 10 }, (_, i) => ({ id: `p${i + 1}`, label: `Bài ${i + 1}` }))

function hang(over: Partial<ContestStandingRow>): ContestStandingRow {
  return {
    rank: 1,
    userId: 'u1',
    displayName: 'Phạm Minh Phong',
    totalPoints: 100,
    acCount: 1,
    lastGain: null,
    problems: { p1: { points: 100, verdict: 'AC', attempts: 1 } },
    isMe: false,
    ...over,
  }
}

function ve(rows: ContestStandingRow[], problems = BAI) {
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
  render(<ContestStandings contestId="c1" problems={problems} />, { wrapper })
}

// Bảng KHÔNG còn <thead> (bản vẽ bỏ hàng tiêu đề cột), nên hàng đầu tiên đã là dữ
// liệu — không được canh theo "nhiều hơn 1 hàng" như hồi còn hàng tiêu đề nữa.
const dong = async (khop: RegExp) =>
  await waitFor(() => {
    const r = screen.getAllByRole('row').find((x) => khop.test(x.textContent ?? ''))
    if (!r) throw new Error(`không có hàng nào khớp ${khop}`)
    return r
  })

describe('bảng xếp hạng contest', () => {
  it('mười bài vẫn CHỈ bốn cột — thêm bài không được bóp cột tên', async () => {
    ve([hang({})])
    const r = await dong(/Phạm Minh Phong/)

    // Đếm Ô của chính hàng dữ liệu chứ không đếm tiêu đề cột: bảng nay không có
    // <thead>, mà điều cần canh vẫn nguyên — thêm bài không được đẻ thêm cột.
    expect(within(r).getAllByRole('cell')).toHaveLength(4)
  })

  it('bỏ hàng tiêu đề nhưng GIỮ caption — trình đọc màn hình còn biết đây là bảng gì', async () => {
    ve([hang({})])
    await dong(/Phạm Minh Phong/)

    expect(screen.queryAllByRole('columnheader')).toHaveLength(0)
    expect(screen.getByRole('table', { name: /xếp hạng contest/i })).toBeInTheDocument()
  })

  it('hiện số bài đã giải trên tổng số, và điểm', async () => {
    ve([hang({ acCount: 3, totalPoints: 260 })])
    const r = await dong(/Phạm Minh Phong/)

    expect(within(r).getByText('3')).toBeInTheDocument()
    expect(within(r).getByText('/10')).toBeInTheDocument()
    expect(within(r).getByText('260')).toBeInTheDocument()
  })

  it('tên đầy đủ nằm ở title, để tên dài vẫn tra được khi bị cắt', async () => {
    ve([hang({ displayName: 'Nguyễn Trần Lê Hoàng Bảo Long Vũ' })])
    const r = await dong(/Nguyễn Trần/)

    expect(within(r).getByTitle('Nguyễn Trần Lê Hoàng Bảo Long Vũ')).toBeInTheDocument()
  })

  it('hàng của mình ghi "Bạn" — và không cần title vì đó không phải tên ai', async () => {
    ve([hang({ isMe: true })])
    const r = await dong(/Bạn/)

    expect(within(r).getByText('Bạn')).toBeInTheDocument()
    expect(within(r).queryByTitle('Phạm Minh Phong')).not.toBeInTheDocument()
  })

  it('ăn điểm một phần: chưa giải xong bài nào vẫn có điểm, hai số nói đúng chuyện đó', async () => {
    // acCount đếm bài AC. Bài đúng 6/10 test không phải "đã giải", nhưng vẫn cộng điểm.
    ve([hang({ acCount: 0, totalPoints: 140 })])
    const r = await dong(/Phạm Minh Phong/)

    expect(within(r).getByText('0')).toBeInTheDocument()
    expect(within(r).getByText('140')).toBeInTheDocument()
  })

  it('chưa ai nộp thì nói rõ, không dựng bảng rỗng', async () => {
    ve([])
    await waitFor(() => expect(screen.getByText('Chưa ai có kết quả')).toBeInTheDocument())
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
