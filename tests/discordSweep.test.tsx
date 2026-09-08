/**
 * Giao diện của bộ khoá-khi-rời-Discord: khối "Quét Discord" ở trang Tình trạng chấm,
 * nhãn trạng thái trên dòng tài khoản, và câu chữ cho mã `roi_server`.
 *
 * Điều được canh: ba trạng thái của bộ quét (tắt / chưa có lượt / có kết quả) phải
 * đọc ra KHÁC NHAU, và lượt bị bỏ phải hiện lý do — bộ quét hỏng suốt tháng mà bảng
 * vẫn im lặng là đúng lớp lỗi "hỏng lặng lẽ" README ghi lại nhiều lần.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DISCORD_REASON } from '@/lib/discord'
import { DiscordSweepCard } from '@/pages/admin/DiscordSweepCard'
import type { AdminUser } from '@/pages/admin/types'
import { UserRow } from '@/pages/admin/UserRow'

describe('DiscordSweepCard', () => {
  it('tắt: nói cần biến gì để bật, không giả vờ "chưa có gì"', () => {
    render(<DiscordSweepCard status={{ enabled: false, last: null }} />)
    expect(screen.getByText('tắt')).toBeInTheDocument()
    expect(screen.getByText(/DISCORD_BOT_TOKEN/)).toBeInTheDocument()
  })

  it('bật nhưng chưa tới giờ: "chưa có lượt nào"', () => {
    render(<DiscordSweepCard status={{ enabled: true, last: null }} />)
    expect(screen.getByText('chưa có lượt nào')).toBeInTheDocument()
  })

  it('lượt trọn: số đã đối chiếu và số bị khoá', () => {
    render(
      <DiscordSweepCard
        status={{ enabled: true, last: { at: '2026-09-08T07:10:00Z', checked: 118, locked: 1, skipped: null } }}
      />,
    )
    expect(screen.getByText('118 tài khoản đã đối chiếu · khoá 1')).toBeInTheDocument()
  })

  it('lượt bị bỏ: hiện LÝ DO, tô màu cảnh báo', () => {
    render(
      <DiscordSweepCard
        status={{ enabled: true, last: { at: '2026-09-08T07:10:00Z', checked: 0, locked: 0, skipped: 'discord_loi' } }}
      />,
    )
    const line = screen.getByText(/Bỏ lượt: Không hỏi được Discord/)
    expect(line).toHaveClass('text-clay')
  })

  it('server cũ chưa trả trường này thì không vẽ gì', () => {
    const { container } = render(<DiscordSweepCard status={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})

const USER: AdminUser = {
  id: 'u1',
  email: 'a@bcn.local',
  username: null,
  displayName: 'Nguyễn Văn A',
  role: 'member',
  disabled: true,
  disabledReason: 'discord_kick',
  disabledAt: '2026-09-08T07:10:00Z',
  mustChangePassword: false,
  lastLogin: null,
  createdAt: '2026-09-01T00:00:00Z',
}

function veDong(user: AdminUser) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <table>
        <tbody>
          <UserRow user={user} onSecret={() => {}} />
        </tbody>
      </table>
    </QueryClientProvider>,
  )
}

describe('UserRow — nhãn khoá', () => {
  it('bộ quét khoá: "Khoá tự động · rời Discord" kèm mốc giờ', () => {
    veDong(USER)
    expect(screen.getByText('Khoá tự động')).toBeInTheDocument()
    expect(screen.getByText(/rời Discord · /)).toBeInTheDocument()
  })

  it('admin khoá tay: "Đã khoá · admin khoá" kèm mốc giờ', () => {
    veDong({ ...USER, disabledReason: 'admin' })
    expect(screen.getByText('Đã khoá')).toBeInTheDocument()
    expect(screen.getByText(/admin khoá · /)).toBeInTheDocument()
  })

  it('khoá từ trước khi có cột lý do: chỉ "Đã khoá", không bịa mốc giờ', () => {
    veDong({ ...USER, disabledReason: null, disabledAt: null })
    expect(screen.getByText('Đã khoá')).toBeInTheDocument()
    expect(screen.queryByText(/admin khoá/)).not.toBeInTheDocument()
  })
})

describe('mã lý do roi_server', () => {
  it('có câu tiếng Việt riêng, nói cách tự mở (vào lại server)', () => {
    expect(DISCORD_REASON.roi_server).toMatch(/vào lại server/i)
    expect(DISCORD_REASON.roi_server).not.toBe(DISCORD_REASON.bi_khoa)
  })
})
