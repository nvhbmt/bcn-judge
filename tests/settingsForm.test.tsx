/**
 * Form cài đặt hệ thống (FR-H2) — ba thứ dễ hỏng lặng lẽ, nên canh bằng test.
 *
 * Cả ba đều thuộc loại "trông vẫn chạy": trang không lỗi, nút vẫn bấm được, chỉ có
 * điều màu thì sai theme, dấu hiệu thì không nhìn thấy, còn nút Lưu thì không biết
 * mình đang sửa cái gì. Kiểu này không tự lộ ra — phải mở đúng trang, ở đúng theme,
 * sau khi đã sửa đúng một ô mới thấy.
 *
 * Bản nháp nay sống ở `useSettingsDraft` chứ không trong form, vì nút Lưu đứng ở hàng
 * tiêu đề (ngoài form). Test dựng lại đúng cách trang ghép hai mảnh đó.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SettingsSaveButton } from '@/pages/admin/SettingsActions'
import { SettingsForm } from '@/pages/admin/SettingsForm'
import { useSettingsDraft } from '@/pages/admin/useSettingsDraft'

const SETTINGS = { default_time_limit_ms: 1000, default_memory_limit_mb: 256 }

/** Đúng cách `SettingsPage` ghép: một bản nháp, hai chỗ dùng. */
function Trang() {
  const draft = useSettingsDraft()
  return (
    <>
      <SettingsSaveButton draft={draft} />
      <SettingsForm settings={SETTINGS} draft={draft} />
    </>
  )
}

function form() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <Trang />
    </QueryClientProvider>,
  )
}

const oThoiGian = () => screen.getByRole('spinbutton', { name: /Giới hạn thời gian/ })

async function sua(giaTri: string) {
  await userEvent.clear(oThoiGian())
  await userEvent.type(oThoiGian(), giaTri)
}

describe('nút lưu ở hàng tiêu đề', () => {
  it('tắt khi chưa sửa gì, bật lên khi có thay đổi', async () => {
    form()
    expect(screen.getByRole('button', { name: 'Lưu cài đặt' })).toBeDisabled()

    await sua('1500')
    expect(screen.getByRole('button', { name: 'Lưu cài đặt' })).toBeEnabled()
  })
})

describe('băng "chưa lưu" bám đáy', () => {
  it('chưa sửa gì thì không có băng nào chiếm chỗ', () => {
    const { container } = form()
    expect(container.querySelector('.sticky')).toBeNull()
  })

  it('sửa rồi thì băng hiện ra, đếm đúng số ô và cho hoàn tác', async () => {
    const { container } = form()
    await sua('1500')

    const bar = container.querySelector('.sticky')
    expect(bar).not.toBeNull()
    expect(screen.getByRole('button', { name: /Lưu 1 thay đổi/ })).toBeEnabled()

    // Nội dung cuộn CHUI XUỐNG dưới thanh này, nên nó bắt buộc phải có nền đục. Một
    // giá trị màu cứng (`bg-[#…]`) thì không đổi theo theme: đúng lỗi đã gặp, thanh
    // xám lạnh #f4f6f9 nằm vắt ngang trang ở nền tối.
    expect(bar!.className).toMatch(/bg-surface-/)
    expect(bar!.className).not.toMatch(/bg-\[#/)

    await userEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }))
    expect(container.querySelector('.sticky')).toBeNull()
    expect(screen.getByRole('button', { name: 'Lưu cài đặt' })).toBeDisabled()
  })
})

describe('dấu hiệu ô đã sửa', () => {
  it('ô chưa chạm thì không đánh dấu', () => {
    const { container } = form()
    expect(container.querySelectorAll('.border-l-moss')).toHaveLength(0)
  })

  it('sửa một ô thì dòng đó được đánh dấu bằng VẠCH, không chỉ bằng nền', async () => {
    const { container } = form()
    await sua('1500')

    // Vạch mới là thứ nhìn thấy được ở CẢ hai theme. Bản trước chỉ đổi nền, lại phủ
    // 40%, nên ở nền tối nó chênh với surface-2 chừng 3/255 — coi như không có.
    const marked = container.querySelectorAll('.border-l-moss')
    expect(marked).toHaveLength(1)
    // `--primary-soft` chứ không phải `--surface-sel`: ở bản sáng surface-sel là be
    // trung tính chroma 0, dùng nhầm là dòng đang sửa mất sạch màu.
    expect(marked[0]!.className).toMatch(/bg-primary-soft/)
  })

  it('hoàn tác thì gỡ hết dấu', async () => {
    const { container } = form()
    await sua('1500')
    await userEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }))

    expect(container.querySelectorAll('.border-l-moss')).toHaveLength(0)
  })
})
