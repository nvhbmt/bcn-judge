/**
 * Form cài đặt hệ thống (FR-H2) — hai thứ dễ hỏng lặng lẽ, nên canh bằng test.
 *
 * Cả hai đều thuộc loại "trông vẫn chạy": trang không lỗi, nút vẫn bấm được, chỉ có
 * điều màu thì sai theme và dấu hiệu thì không nhìn thấy. Kiểu này không tự lộ ra —
 * phải mở đúng trang, ở đúng theme, sau khi đã sửa đúng một ô mới thấy.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SettingsForm } from '@/pages/admin/SettingsForm'

const SETTINGS = { default_time_limit_ms: 1000, default_memory_limit_mb: 256 }

function form() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SettingsForm settings={SETTINGS} />
    </QueryClientProvider>,
  )
}

describe('thanh hành động dính đáy', () => {
  it('lấy nền từ token chứ không phải màu cứng — nếu không thì nền tối hỏng', () => {
    const { container } = form()
    const bar = container.querySelector('.sticky')
    expect(bar).not.toBeNull()

    // Nội dung cuộn CHUI XUỐNG dưới thanh này, nên nó bắt buộc phải có nền đục. Một
    // giá trị màu cứng (`bg-[#…]`) thì không đổi theo theme: đúng lỗi đã gặp, thanh
    // xám lạnh #f4f6f9 nằm vắt ngang trang ở nền tối.
    const cls = bar!.className
    expect(cls).toMatch(/bg-surface-/)
    expect(cls).not.toMatch(/bg-\[#/)
  })
})

describe('dấu hiệu ô đã sửa', () => {
  it('ô chưa chạm thì không đánh dấu', () => {
    const { container } = form()
    expect(container.querySelectorAll('.border-l-moss')).toHaveLength(0)
  })

  it('sửa một ô thì ô đó được đánh dấu bằng VẠCH, không chỉ bằng nền', async () => {
    const { container } = form()
    await userEvent.clear(screen.getByRole('spinbutton', { name: /Giới hạn thời gian/ }))
    await userEvent.type(screen.getByRole('spinbutton', { name: /Giới hạn thời gian/ }), '1500')

    // Vạch mới là thứ nhìn thấy được ở CẢ hai theme. Bản trước chỉ đổi nền, lại phủ
    // 40%, nên ở nền tối nó chênh với surface-2 chừng 3/255 — coi như không có.
    const marked = container.querySelectorAll('.border-l-moss')
    expect(marked).toHaveLength(1)
    expect(marked[0]!.className).toMatch(/bg-surface-sel/)

    expect(screen.getByRole('button', { name: /Lưu 1 thay đổi/ })).toBeEnabled()
  })

  it('hoàn tác thì gỡ hết dấu', async () => {
    const { container } = form()
    await userEvent.clear(screen.getByRole('spinbutton', { name: /Giới hạn thời gian/ }))
    await userEvent.type(screen.getByRole('spinbutton', { name: /Giới hạn thời gian/ }), '1500')
    await userEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }))

    expect(container.querySelectorAll('.border-l-moss')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Chưa có thay đổi' })).toBeDisabled()
  })
})
