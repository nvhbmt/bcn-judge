/**
 * Giá trị form contest + phép dịch sang payload API. Tách khỏi component vì đây là
 * *hợp đồng với API*, kiểm được bằng test thuần.
 *
 * Ba điều của server quyết định cách dựng payload ở đây:
 *
 *   1. `PATCH /:id` dùng `COALESCE(<giá trị>, cột)` → không có cách gửi NULL, và
 *      trường KHÔNG gửi = giữ nguyên. Nên chỉ gửi trường thực sự đổi.
 *   2. Danh sách contest không trả `descriptionMd` / `sequential`, mà lại KHÔNG có
 *      `GET /:id`. Hai trường ấy vì thế chỉ được gửi khi người dùng tự chạm vào:
 *      gửi giá trị mặc định của form sẽ ghi đè mất thứ đang có trên server.
 *   3. `PATCH` không kiểm `endAt > startAt` (chỉ `POST` kiểm) → FE phải tự chặn,
 *      không thì contest kết thúc trước khi bắt đầu và bảng xếp hạng rỗng.
 */
import { localInputToIso } from './mentorTime'
import type { ContestBody } from './useContests'

export interface ContestFormValues {
  title: string
  descriptionMd: string
  /** null = toàn câu lạc bộ (chỉ admin đặt được, server trả 403 cho mentor). */
  courseId: string | null
  startAt: string
  endAt: string
  /** Giữ dạng chuỗi: ô number rỗng đọc ra '' và ép Number ngay lúc gõ sẽ nhảy về 0. */
  freezeMinutes: string
  sequential: boolean
}

export const EMPTY_CONTEST: ContestFormValues = {
  title: '',
  descriptionMd: '',
  courseId: null,
  startAt: '',
  endAt: '',
  freezeMinutes: '0',
  sequential: false,
}

export function validateContest(v: ContestFormValues): string | null {
  if (v.title.trim().length === 0) return 'Tên contest không được để trống.'
  if (v.title.trim().length > 200) return 'Tên contest tối đa 200 ký tự.'

  const start = localInputToIso(v.startAt)
  const end = localInputToIso(v.endAt)
  if (!start) return 'Chưa chọn thời điểm bắt đầu.'
  if (!end) return 'Chưa chọn thời điểm kết thúc.'
  if (new Date(end).getTime() <= new Date(start).getTime()) return 'Giờ kết thúc phải sau giờ bắt đầu.'

  const freeze = Number.parseInt(v.freezeMinutes, 10)
  if (!Number.isFinite(freeze) || freeze < 0 || freeze > 600) {
    return 'Số phút đóng băng phải là số nguyên từ 0 đến 600.'
  }
  return null
}

export function toCreateBody(v: ContestFormValues): ContestBody {
  const body: ContestBody = {
    title: v.title.trim(),
    courseId: v.courseId,
    startAt: localInputToIso(v.startAt) ?? '',
    endAt: localInputToIso(v.endAt) ?? '',
    freezeMinutes: Number.parseInt(v.freezeMinutes, 10) || 0,
    sequential: v.sequential,
  }
  if (v.descriptionMd.trim()) body.descriptionMd = v.descriptionMd
  return body
}

/** Chỉ những trường ĐÃ ĐỔI — xem luật 1 và 2 ở đầu file. */
export function toUpdateBody(
  initial: ContestFormValues,
  v: ContestFormValues,
  opts: { sequentialTouched: boolean },
): ContestBody {
  const body: ContestBody = {}
  if (v.title.trim() !== initial.title.trim()) body.title = v.title.trim()
  if (v.startAt !== initial.startAt) body.startAt = localInputToIso(v.startAt) ?? undefined
  if (v.endAt !== initial.endAt) body.endAt = localInputToIso(v.endAt) ?? undefined
  if (v.freezeMinutes !== initial.freezeMinutes) {
    const freeze = Number.parseInt(v.freezeMinutes, 10)
    if (Number.isFinite(freeze)) body.freezeMinutes = freeze
  }
  // Mô tả rỗng KHÔNG gửi: '' không phải NULL nên COALESCE sẽ xoá sạch mô tả cũ,
  // mà form thì không đọc được mô tả cũ để so sánh.
  if (v.descriptionMd.trim()) body.descriptionMd = v.descriptionMd
  if (opts.sequentialTouched) body.sequential = v.sequential
  // courseId cố tình KHÔNG gửi: câu UPDATE của server không ghi cột course_id nên
  // gửi cũng vô ích, chỉ làm người đọc tưởng đổi được phạm vi contest.
  return body
}
