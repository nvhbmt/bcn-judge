/**
 * Danh sách thành viên ở /team và trang riêng của từng người.
 *
 * Bản trước đổ hết ra một lượt: dải chip tên (bấm không làm gì) + bảng MỘT DÒNG MỖI
 * CẶP (người × khoá) — 6 người 2 khoá thành 12 dòng tên lặp sáu lần — rồi câu "bấm
 * tên một thành viên" nằm tận đáy. Ba điều được canh ở đây:
 *
 *   - MỘT dòng mỗi người, và dòng đó là LIÊN KẾT thật sang trang riêng;
 *   - người chưa ghi danh khoá nào VẪN có dòng. Endpoint tiến độ chỉ trả người đã
 *     ghi danh, nên bảng cũ nuốt mất đúng những người leader cần nhìn nhất;
 *   - không phải leader thì không có liên kết nào — lớp che khớp với guard ở server.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TeamMemberPage } from '@/pages/TeamMemberPage'
import { TeamMembers } from '@/pages/team/TeamMembers'
import type { TeamProgressRow, TeamSubmissionRow, TeamView } from '@/pages/team/types'
import { VERDICT_LABEL } from '@/types/api'

afterEach(() => vi.restoreAllMocks())

const TEAM: TeamView = {
  id: 't1',
  name: 'Nhóm Beta',
  createdAt: '2026-09-01T00:00:00.000Z',
  descriptionMd: null,
  leaderId: 'u1',
  isLeader: true,
  members: [
    { id: 'u1', displayName: 'Huỳnh Đức Hà', isLeader: true },
    { id: 'u2', displayName: 'Bùi Thu Ngọc', isLeader: false },
    { id: 'u3', displayName: 'Chưa Ghi Danh', isLeader: false },
  ],
}

const TIEN_DO: TeamProgressRow[] = [
  { userId: 'u1', displayName: 'Huỳnh Đức Hà', courseId: 'c1', courseName: 'C cơ bản', acCount: 3, totalItems: 4, lastSubmittedAt: '2026-08-30T00:00:00.000Z' },
  { userId: 'u1', displayName: 'Huỳnh Đức Hà', courseId: 'c2', courseName: 'Thuật toán', acCount: 2, totalItems: 3, lastSubmittedAt: '2026-08-22T00:00:00.000Z' },
  { userId: 'u2', displayName: 'Bùi Thu Ngọc', courseId: 'c1', courseName: 'C cơ bản', acCount: 2, totalItems: 4, lastSubmittedAt: null },
]

function mock(map: Record<string, unknown>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(typeof input === 'string' ? input : (input as Request).url)
    for (const [phan, data] of Object.entries(map)) {
      if (url.includes(phan)) {
        return new Response(JSON.stringify({ success: true, data, meta: {} }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
    }
    return new Response(JSON.stringify({ success: true, data: [], meta: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
}

function ve(node: ReactNode, url = '/team') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/team" element={<>{node}</>} />
          <Route path="/team/thanh-vien/:userId" element={<TeamMemberPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('danh sách thành viên', () => {
  it('MỘT dòng mỗi người, và dòng đó dẫn sang trang riêng', async () => {
    mock({ '/progress': TIEN_DO })
    ve(<TeamMembers team={TEAM} />)

    // 3 người, 3 dòng — không phải 3 dòng tiến độ nhân số khoá.
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3))
    expect(screen.getByRole('link', { name: /Huỳnh Đức Hà/ })).toHaveAttribute('href', '/team/thanh-vien/u1')
  })

  it('gộp mọi khoá thành MỘT con số, không lặp tên theo từng khoá', async () => {
    mock({ '/progress': TIEN_DO })
    ve(<TeamMembers team={TEAM} />)

    const r = await screen.findByRole('link', { name: /Huỳnh Đức Hà/ })
    // 3/4 + 2/3 = 5/7
    expect(within(r).getByText('5/7 bài')).toBeInTheDocument()
    expect(screen.getAllByText(/Huỳnh Đức Hà/)).toHaveLength(1)
  })

  it('người chưa ghi danh khoá nào VẪN có dòng, và nói rõ là chưa ghi danh', async () => {
    mock({ '/progress': TIEN_DO })
    ve(<TeamMembers team={TEAM} />)

    const r = await screen.findByRole('link', { name: /Chưa Ghi Danh/ })
    expect(within(r).getByText('chưa ghi danh')).toBeInTheDocument()
  })

  it('có ghi danh mà chưa nộp lần nào thì nói "chưa nộp", không để trống', async () => {
    mock({ '/progress': TIEN_DO })
    ve(<TeamMembers team={TEAM} />)

    expect(within(await screen.findByRole('link', { name: /Bùi Thu Ngọc/ })).getByText('chưa nộp')).toBeInTheDocument()
  })

  it('không phải leader thì không có liên kết nào — khớp với guard ở server', async () => {
    mock({})
    ve(<TeamMembers team={{ ...TEAM, isLeader: false }} />)

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3))
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})

describe('trang riêng của một thành viên — hai panel', () => {
  const NOP: TeamSubmissionRow[] = [
    { id: 's1', userId: 'u2', problemTitle: 'Tổng hai số', languageId: 'c11', verdict: 'AC', score: 100, receivedAt: '2026-09-03T15:26:00.000Z', source: 'int main(){}', sourceEmbargoedUntil: null },
    { id: 's2', userId: 'u2', problemTitle: 'Đếm ước số', languageId: 'c11', verdict: 'WA', score: 0, receivedAt: '2026-09-03T10:34:00.000Z', source: null, sourceEmbargoedUntil: '2026-09-05T23:59:59.000Z' },
  ]

  it('panel trái có cả chọn người lẫn chọn lượt nộp', async () => {
    mock({ '/teams/mine': TEAM, '/submissions': NOP })
    ve(null, '/team/thanh-vien/u2')

    const nav = await screen.findByRole('navigation', { name: 'Chuyển thành viên' })
    expect(within(nav).getAllByRole('link')).toHaveLength(3)
    // aria-current chứ không chỉ đổi màu: người dùng trình đọc màn hình cũng cần
    // biết mình đang đứng ở đâu.
    expect(within(nav).getByRole('link', { current: 'page' })).toHaveTextContent('Bùi Thu Ngọc')
    expect(await screen.findByText('100đ')).toBeInTheDocument()
  })

  it('mặc định mở lượt MỚI NHẤT — đó là câu hỏi leader mở trang này để hỏi', async () => {
    mock({ '/teams/mine': TEAM, '/submissions': NOP })
    ve(null, '/team/thanh-vien/u2')

    expect(await screen.findByText('int main(){}')).toBeInTheDocument()
  })

  it('bấm một lượt khác thì panel phải đổi theo', async () => {
    mock({ '/teams/mine': TEAM, '/submissions': NOP })
    ve(null, '/team/thanh-vien/u2')

    await screen.findByText('int main(){}')
    await userEvent.click(screen.getByRole('button', { name: new RegExp(VERDICT_LABEL.WA) }))

    // Lượt này bị khoá source (contest đang chạy) — panel phải nói lý do, không để trống.
    expect(await screen.findByText(/Contest đang diễn ra/)).toBeInTheDocument()
    expect(screen.queryByText('int main(){}')).not.toBeInTheDocument()
  })

  it('source bị khoá thì KHÔNG có khối mã nào, chỉ có lời giải thích', async () => {
    mock({ '/teams/mine': TEAM, '/submissions': [NOP[1]] })
    ve(null, '/team/thanh-vien/u2')

    expect(await screen.findByText(/Contest đang diễn ra/)).toBeInTheDocument()
    expect(document.querySelector('pre')).toBeNull()
  })

  it('chưa nộp lần nào thì panel phải mời chọn, không dựng khung rỗng', async () => {
    mock({ '/teams/mine': TEAM, '/submissions': [] })
    ve(null, '/team/thanh-vien/u2')

    expect(await screen.findByText('Chưa nộp bài nào')).toBeInTheDocument()
    expect(screen.getByText('Chọn một lượt nộp')).toBeInTheDocument()
  })

  it('userId không thuộc team thì nói rõ, không hiện bài nộp của ai khác', async () => {
    mock({ '/teams/mine': TEAM, '/submissions': NOP })
    ve(null, '/team/thanh-vien/nguoi-la')

    expect(await screen.findByText('Không có thành viên này')).toBeInTheDocument()
  })

  it('không phải leader thì bị đưa về /team', async () => {
    mock({ '/teams/mine': { ...TEAM, isLeader: false } })
    ve(<p>danh sách team</p>, '/team/thanh-vien/u2')

    expect(await screen.findByText('danh sách team')).toBeInTheDocument()
  })
})
