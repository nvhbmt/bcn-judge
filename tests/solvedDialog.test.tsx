/**
 * Hộp thoại mừng AC: cổng mở (useSolvedDialog) và chính hộp thoại (SolvedDialog).
 *
 * Hai bất biến dễ vỡ nhất:
 *   - chỉ mở khi lượt NỘP đang theo dõi trả AC + done, và ĐÚNG MỘT lần (stream cập
 *     nhật nhiều nhịp);
 *   - đổi bài thì quên, để lượt nộp ở bài mới mở lại được.
 */
import { render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SolvedDialog } from '@/pages/workspace/SolvedDialog'
import { useSolvedDialog } from '@/pages/workspace/useSolvedDialog'
import type { SubmissionView } from '@/types/api'

const sub = (over: Partial<SubmissionView>): SubmissionView =>
  ({ id: 's1', status: 'done', verdict: 'AC', score: 100, ...over }) as SubmissionView

describe('useSolvedDialog — cổng mở', () => {
  it('mở khi lượt nộp đang theo dõi trả AC + done', () => {
    const { result } = renderHook(() => useSolvedDialog(sub({}), 's1', 'bai-1'))
    expect(result.current.open).toBe(true)
  })

  it('KHÔNG mở khi chưa done, hay verdict khác AC, hay không phải lượt đang theo dõi', () => {
    expect(renderHook(() => useSolvedDialog(sub({ status: 'running', verdict: null }), 's1', 'b')).result.current.open).toBe(false)
    expect(renderHook(() => useSolvedDialog(sub({ verdict: 'WA' }), 's1', 'b')).result.current.open).toBe(false)
    // submission là của lượt KHÁC (id lệch watchedId) — ví dụ đang xem lại lịch sử.
    expect(renderHook(() => useSolvedDialog(sub({ id: 'cu' }), 's1', 'b')).result.current.open).toBe(false)
  })

  it('đóng rồi thì cùng một submission KHÔNG mở lại (đúng một lần mỗi lượt)', () => {
    const s = sub({})
    const { result, rerender } = renderHook(({ x }) => useSolvedDialog(x, 's1', 'bai-1'), {
      initialProps: { x: s },
    })
    expect(result.current.open).toBe(true)
    result.current.close()
    rerender({ x: { ...s } }) // stream phát lại cùng id
    expect(result.current.open).toBe(false)
  })

  it('đổi bài (handle đổi) thì quên — lượt AC ở bài mới mở lại được', () => {
    const { result, rerender } = renderHook(({ s, h }) => useSolvedDialog(s, s.id, h), {
      initialProps: { s: sub({ id: 'a' }), h: 'bai-1' },
    })
    expect(result.current.open).toBe(true)
    result.current.close()
    rerender({ s: sub({ id: 'b' }), h: 'bai-2' }) // sang bài khác, lượt nộp mới cũng AC
    expect(result.current.open).toBe(true)
  })
})

describe('SolvedDialog — nút theo có/không bài kế', () => {
  const draw = (next: { href: string; title: string } | null) =>
    render(
      <MemoryRouter>
        <SolvedDialog score={100} next={next} onStay={() => {}} onNext={() => {}} />
      </MemoryRouter>,
    )

  it('có bài kế: hiện "Làm bài tiếp" trỏ đúng href, và "Ở lại"', () => {
    draw({ href: '/khoa-hoc/c/bai/2', title: 'Bài 2' })
    expect(screen.getByRole('link', { name: /Làm bài tiếp/ })).toHaveAttribute('href', '/khoa-hoc/c/bai/2')
    expect(screen.getByRole('button', { name: 'Ở lại' })).toBeInTheDocument()
  })

  it('bài cuối: KHÔNG có nút đi tiếp, nói rõ là bài cuối', () => {
    draw(null)
    expect(screen.queryByRole('link', { name: /Làm bài tiếp/ })).toBeNull()
    expect(screen.getByText(/bài cuối/)).toBeInTheDocument()
  })

  it('là hộp thoại thật cho trình đọc màn hình', () => {
    draw(null)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })
})
