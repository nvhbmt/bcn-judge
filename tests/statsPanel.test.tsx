/**
 * Mục "Thống kê" của thanh icon (FR-E3 v0.8): ba trạng thái (rỗng / có số / có "mình"),
 * thanh verdict dùng đúng token màu, và ô thời gian của mình được đánh dấu.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bucketIndexOf, TimeHistogram } from '@/pages/workspace/stats/TimeHistogram'
import { StatsPanel } from '@/pages/workspace/stats/StatsPanel'
import { RAIL_ITEMS, RAIL_ITEMS_DISCUSSION, RAIL_ITEMS_LESSON } from '@/pages/workspace/rail'
import type { ProblemStats } from '@/types/api'

afterEach(() => vi.restoreAllMocks())

const BUCKETS: ProblemStats['time']['buckets'] = [
  { upToMs: 16, count: 0 },
  { upToMs: 32, count: 3 },
  { upToMs: 63, count: 5 },
  { upToMs: 125, count: 1 },
  { upToMs: 250, count: 0 },
  { upToMs: 500, count: 0 },
  { upToMs: 1000, count: 0 },
  { upToMs: null, count: 1 },
]

const STATS: ProblemStats = {
  submissions: 42,
  users: 20,
  solvedUsers: 10,
  verdicts: { AC: 12, WA: 20, TLE: 8, MLE: 0, RE: 2, CE: 0 },
  languages: [
    { id: 'c11', count: 30 },
    { id: 'python3', count: 12 },
  ],
  time: { limitMs: 1000, p50: 40, p90: 110, buckets: BUCKETS },
  mine: { bestTimeMs: 20, bestMemoryKb: 1200, fasterThanPct: 87 },
}

function mock(data: ProblemStats) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ success: true, data, meta: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

function draw() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StatsPanel handleQuery="itemId=i1" />
    </QueryClientProvider>,
  )
}

describe('StatsPanel', () => {
  it('có dữ liệu: dải số, tỉ lệ giải, chú giải verdict với phần trăm, dòng "Bạn"', async () => {
    mock(STATS)
    draw()
    await waitFor(() => expect(screen.getByText('Lượt nộp')).toBeInTheDocument())
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('10/20')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    // Thanh verdict: có vai trò img với mô tả đọc được, và đúng token màu của WA.
    const bar = screen.getByRole('img', { name: /Phân bố verdict: AC 12, WA 20/ })
    const wa = within(bar).getByTitle('WA: 20')
    expect(wa.style.background).toContain('--verdict-wa')
    // Dòng của mình.
    expect(screen.getByText('Bạn:')).toBeInTheDocument()
    expect(screen.getByText('87%')).toBeInTheDocument()
    expect(screen.getByText(/p50 40 ms · p90 110 ms/)).toBeInTheDocument()
  })

  it('chưa AC: không có dòng "Bạn"; một mình AC thì nói "chưa có ai khác AC để so"', async () => {
    mock({ ...STATS, mine: null })
    draw()
    await waitFor(() => expect(screen.getByText('Lượt nộp')).toBeInTheDocument())
    expect(screen.queryByText('Bạn:')).toBeNull()
  })

  it('một mình AC: pct null → câu "chưa có ai khác", không phải 100%', async () => {
    mock({ ...STATS, mine: { bestTimeMs: 20, bestMemoryKb: null, fasterThanPct: null } })
    draw()
    await waitFor(() => expect(screen.getByText(/chưa có ai khác AC để so/)).toBeInTheDocument())
  })

  it('chưa ai nộp thì trạng thái rỗng, không dựng biểu đồ', async () => {
    mock({ ...STATS, submissions: 0, users: 0, solvedUsers: 0, mine: null })
    draw()
    await waitFor(() => expect(screen.getByText('Chưa ai nộp bài này')).toBeInTheDocument())
    expect(screen.queryByRole('img')).toBeNull()
  })
})

describe('TimeHistogram', () => {
  it('bucketIndexOf: ô đầu có mốc ≥ ms; vượt mọi mốc → ô cuối; null → không ô nào', () => {
    expect(bucketIndexOf(BUCKETS, 20)).toBe(1)
    expect(bucketIndexOf(BUCKETS, 32)).toBe(1)
    expect(bucketIndexOf(BUCKETS, 33)).toBe(2)
    expect(bucketIndexOf(BUCKETS, 5000)).toBe(7)
    expect(bucketIndexOf(BUCKETS, null)).toBe(-1)
  })

  it('nhãn "≤ N ms" và ô cuối "> 1000 ms"; ô của mình tô moss', () => {
    render(<TimeHistogram buckets={BUCKETS} mineMs={20} />)
    expect(screen.getByText('≤ 32 ms')).toHaveClass('text-moss')
    expect(screen.getByText('≤ 63 ms')).not.toHaveClass('text-moss')
    expect(screen.getByText('> 1000 ms')).toBeInTheDocument()
  })
})

describe('thanh icon', () => {
  it('Thống kê có ở rail khoá lẫn contest, không có ở rail bài đọc', () => {
    expect(RAIL_ITEMS.map((i) => i.key)).toContain('thong-ke')
    expect(RAIL_ITEMS_DISCUSSION.map((i) => i.key)).toContain('thong-ke')
    expect(RAIL_ITEMS_LESSON.map((i) => i.key)).not.toContain('thong-ke')
  })
})
