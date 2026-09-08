/**
 * Mục "Lời giải" (FR-K v0.8): ba trạng thái đóng/mở, bảng có mình làm mốc, bấm một
 * người là mở màn so sánh hai cột; công tắc chia sẻ ở trang Tài khoản ghi ngay; thanh
 * icon có "Lời giải" ở khoá và ẩn trong contest đang chạy.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShareSolutionsToggle } from '@/pages/account/ShareSolutionsToggle'
import { RAIL_ITEMS, RAIL_ITEMS_DISCUSSION, RAIL_ITEMS_LESSON } from '@/pages/workspace/rail'
import { SolutionsPanel } from '@/pages/workspace/solutions/SolutionsPanel'
import type { PeerSolution, SolutionsData } from '@/pages/workspace/solutions/types'
import type { LanguageOption, Me } from '@/types/api'

afterEach(() => vi.restoreAllMocks())

const LANGS: LanguageOption[] = [
  { id: 'c11', name: 'C', versionLabel: null, cmMode: 'c' },
  { id: 'python3', name: 'Python', versionLabel: null, cmMode: 'python' },
]

const MINE: PeerSolution = {
  id: 's-me',
  userId: 'u1',
  authorName: 'Tôi',
  avatarUrl: null,
  languageId: 'c11',
  timeMsMax: 70,
  memoryKbMax: 1200,
  sourceBytes: 120,
  receivedAt: '2026-09-07T10:00:00Z',
  isMine: true,
  source: 'int main() { return 1; }',
}
const PEER: PeerSolution = {
  id: 's-lan',
  userId: 'u2',
  authorName: 'Lan',
  avatarUrl: null,
  languageId: 'python3',
  timeMsMax: 20,
  memoryKbMax: 900,
  sourceBytes: 2048,
  receivedAt: '2026-09-07T11:00:00Z',
  isMine: false,
}
const OPEN: SolutionsData = {
  canAccess: true,
  reason: null,
  embargoUntil: null,
  mine: MINE,
  reference: { languageId: 'c11', source: '// loi giai mau' },
  peers: [PEER],
}

function mock(list: SolutionsData, detail?: PeerSolution) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    const data = /\/solutions\/s-/.test(url) ? detail : list
    return Promise.resolve(
      new Response(JSON.stringify({ success: true, data, meta: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
  })
}

function draw(node = <SolutionsPanel handleQuery="itemId=i1" languages={LANGS} />) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>,
  )
}

describe('SolutionsPanel', () => {
  it('chưa giải: khoá, không có bảng', async () => {
    mock({ ...OPEN, canAccess: false, reason: 'not_solved', mine: null, reference: null, peers: [] })
    draw()
    await waitFor(() => expect(screen.getByText(/Giải được bài này rồi mới xem/)).toBeInTheDocument())
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('cấm vận contest: nói mở lại lúc nào, không phải "chưa giải"', async () => {
    mock({ ...OPEN, canAccess: false, reason: 'contest_embargo', embargoUntil: '2026-09-14T17:00:00Z', mine: null, reference: null, peers: [] })
    draw()
    await waitFor(() => expect(screen.getByText('Contest đang diễn ra')).toBeInTheDocument())
    expect(screen.getByText(/mở lại sau/)).toBeInTheDocument()
    expect(screen.queryByText(/Giải được bài này/)).toBeNull()
  })

  it('mở: lời giải mẫu gập sẵn, bảng có "Bạn" làm mốc và người khác, số đo đúng định dạng', async () => {
    mock(OPEN)
    draw()
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    expect(screen.getByText('Lời giải mẫu của mentor')).toBeInTheDocument()
    expect(screen.getByText('1 người chia sẻ')).toBeInTheDocument()
    expect(screen.getByText('Bạn')).toBeInTheDocument()
    expect(screen.getByText('Lan')).toBeInTheDocument()
    expect(screen.getByText('20 ms')).toBeInTheDocument()
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
  })

  it('bấm một người → nạp chi tiết rồi mở màn so sánh hai cột; "Danh sách" quay lại', async () => {
    mock(OPEN, { ...PEER, source: 'print(1)' })
    draw()
    await waitFor(() => expect(screen.getByText('Lan')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Lan/ }))
    await waitFor(() => expect(screen.getByText('So sánh với Lan')).toBeInTheDocument())
    // Hai cột: mã của mình và của Lan đều hiện. Mã đã tô màu (hljs tách token thành nhiều
    // span) nên so trên textContent của cả trang, không tìm một phần tử mang trọn chuỗi.
    expect(document.body.textContent).toContain('return 1')
    expect(document.body.textContent).toContain('print(1)')
    fireEvent.click(screen.getByRole('button', { name: /Danh sách/ }))
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
  })

  it('đổi bộ lọc ngôn ngữ và thứ tự thì gọi API với tham số tương ứng', async () => {
    mock(OPEN)
    draw()
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    fireEvent.change(screen.getByRole('combobox', { name: 'Lọc ngôn ngữ' }), { target: { value: 'python3' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Xếp theo' }), { target: { value: 'memory' } })
    await waitFor(() =>
      expect(
        (vi.mocked(globalThis.fetch).mock.calls as unknown[][]).some(
          (c) => String(c[0]).includes('languageId=python3') && String(c[0]).includes('sort=memory'),
        ),
      ).toBe(true),
    )
  })

  it('mở nhưng chưa ai chia sẻ: trạng thái rỗng nhắc công tắc ở trang Tài khoản', async () => {
    mock({ ...OPEN, peers: [], reference: null })
    draw()
    await waitFor(() => expect(screen.getByText('Chưa ai chia sẻ lời giải bài này')).toBeInTheDocument())
  })
})

describe('ShareSolutionsToggle', () => {
  const ME: Me = {
    id: 'u1',
    email: 'a@bcn.local',
    displayName: 'A',
    role: 'member',
    mustChangePassword: false,
    discordUsername: null,
    avatarUrl: null,
    shareSolutions: true,
  }

  it('bỏ tick là gửi PATCH /auth/me { shareSolutions: false } ngay, không cần nút Lưu', async () => {
    const calls: { url: string; body: string }[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: String(init?.body ?? '') })
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: { ...ME, shareSolutions: false }, meta: {} }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    })
    draw(<ShareSolutionsToggle me={ME} />)
    const box = screen.getByRole('checkbox', { name: /Cho thành viên khác xem bài AC của tôi/ })
    expect(box).toBeChecked()
    fireEvent.click(box)
    await waitFor(() => expect(calls.some((c) => c.url.includes('/auth/me') && c.body.includes('"shareSolutions":false'))).toBe(true))
  })
})

describe('thanh icon', () => {
  it('"Lời giải" có ở rail bài luyện (cùng Thảo luận), không ở rail contest hay bài đọc', () => {
    expect(RAIL_ITEMS_DISCUSSION.map((i) => i.key)).toContain('loi-giai')
    expect(RAIL_ITEMS.map((i) => i.key)).not.toContain('loi-giai')
    expect(RAIL_ITEMS_LESSON.map((i) => i.key)).not.toContain('loi-giai')
  })
})
