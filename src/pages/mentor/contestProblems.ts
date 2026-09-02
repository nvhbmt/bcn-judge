/**
 * Logic thuần của "Bài trong contest" (FR-I2) — tách khỏi UI để test được thẳng và
 * để khung phải của trang sửa contest không phình quá trần 250 dòng.
 *
 * THỨ TỰ TRONG MẢNG CHÍNH LÀ `position`: server đánh số lại 1..n theo index, nên
 * không có trường thứ tự nào để sửa — đổi vị trí là đổi chỗ trong mảng.
 */
import type { ContestProblemDraft } from './mentorTypes'

/** Nhãn mặc định A, B, C… theo vị trí — đúng thói quen đề thi. */
export const defaultLabel = (index: number): string => String.fromCharCode(65 + (index % 26))

export function validateDrafts(drafts: ContestProblemDraft[]): string | null {
  if (drafts.length === 0) return 'Chọn ít nhất một bài trước khi lưu.'
  for (const d of drafts) {
    if (d.label.length > 4) return `Nhãn "${d.label}" dài quá 4 ký tự.`
    const score = Number.parseInt(d.maxScore, 10)
    if (!Number.isFinite(score) || score < 1 || score > 10_000) {
      return `Điểm tối đa của bài "${d.title}" phải là số nguyên từ 1 đến 10000.`
    }
  }
  return null
}

export function toPayload(
  drafts: ContestProblemDraft[],
): { problemId: string; label: string; maxScore: number }[] {
  return drafts.map((d) => ({
    problemId: d.problemId,
    label: d.label,
    maxScore: Number.parseInt(d.maxScore, 10),
  }))
}

/**
 * Đổi chỗ phần tử `index` với hàng xóm theo `delta`; null khi ra ngoài mảng.
 *
 * Bản riêng thay vì dùng `swapped` của useCourseContent: cái kia nhận mảng mục giáo
 * trình và đi kèm cả một module mutation của khoá học, kéo theo là kéo nhầm phụ thuộc.
 */
export function moved<T>(list: T[], index: number, delta: -1 | 1): T[] | null {
  const to = index + delta
  if (to < 0 || to >= list.length) return null
  const next = [...list]
  const a = next[index]!
  next[index] = next[to]!
  next[to] = a
  return next
}
