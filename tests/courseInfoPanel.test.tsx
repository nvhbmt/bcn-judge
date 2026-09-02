/**
 * Khung TRÁI của màn soạn khoá: thông tin khoá + mô tả (FR-C1, FR-B2).
 *
 * Hai điều test canh:
 *
 *  1. **Ô mô tả phải mang mô tả THẬT.** Panel `useState(course.descriptionMd)` một
 *     lần, nên trang phải chờ tải xong rồi mới dựng nó. Dựng sớm thì ô hiện rỗng dù
 *     khoá có mô tả, và bấm lưu là xoá mất — đúng lớp lỗi đã gặp ở `ContestForm`.
 *  2. **Chỉ mô tả sửa được.** `PATCH /api/mentor/courses/:id` nhận đúng một trường
 *     `descriptionMd`; mã, tên, trạng thái là quyền admin. Chúng phải hiện ra ở dạng
 *     chỉ-đọc chứ không bị giấu, nếu không mentor đi tìm ô sửa tên mãi không thấy.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { CourseInfoPanel } from '@/pages/mentor/CourseInfoPanel'
import type { MentorCourseDetail } from '@/pages/mentor/mentorTypes'

const COURSE: MentorCourseDetail = {
  id: 'c1',
  code: 'c-co-ban-k12',
  name: 'C cơ bản — khoá 12',
  descriptionMd: '## Mục tiêu\n\nLàm quen cú pháp C.',
  status: 'open',
  selfEnroll: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

function renderPanel(over: Partial<MentorCourseDetail> = {}) {
  const onSave = vi.fn()
  render(
    <MemoryRouter>
      <CourseInfoPanel
        course={{ ...COURSE, ...over }}
        mentors={[{ id: 'm1', displayName: 'Trần Thu Hà', email: 'mentor2@bcn.local' }]}
        pending={false}
        saved={false}
        error={null}
        onSave={onSave}
      />
    </MemoryRouter>,
  )
  return { onSave }
}

const descBox = () => screen.getByLabelText('Mô tả khoá (Markdown)')
const saveButton = () => screen.getByRole('button', { name: /Lưu mô tả/ })

describe('CourseInfoPanel', () => {
  it('ô mô tả mở ra đã có mô tả thật của khoá', () => {
    renderPanel()
    expect(descBox()).toHaveProperty('value', COURSE.descriptionMd)
  })

  it('chưa sửa gì thì nút lưu tắt — bấm lưu một nội dung y hệt là vô nghĩa', () => {
    renderPanel()
    expect(saveButton()).toHaveProperty('disabled', true)
  })

  it('sửa xong thì gửi đúng nội dung đang gõ', async () => {
    const { onSave } = renderPanel()
    await userEvent.clear(descBox())
    await userEvent.type(descBox(), 'Mô tả mới')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith('Mô tả mới')
  })

  it('xoá sạch mô tả rồi lưu là gửi chuỗi rỗng — phải xoá được, không bị nuốt', async () => {
    const { onSave } = renderPanel()
    await userEvent.clear(descBox())
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith('')
  })

  it('mã, tên, trạng thái, mentor hiện ra ở dạng chỉ-đọc, không có ô nhập nào', () => {
    renderPanel()
    expect(screen.getByText('c-co-ban-k12')).toBeTruthy()
    expect(screen.getByText('C cơ bản — khoá 12')).toBeTruthy()
    expect(screen.getByText('Đang mở')).toBeTruthy()
    expect(screen.getByText('Trần Thu Hà')).toBeTruthy()
    // Đúng MỘT ô nhập trên cả khung: ô mô tả.
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
  })

  it('khoá chưa có mô tả thì ô rỗng, không phải chữ "null"', () => {
    renderPanel({ descriptionMd: null })
    expect(descBox()).toHaveProperty('value', '')
  })
})
