/**
 * FR-I1: trạng thái contest SUY RA từ khung thời gian — server không lưu cột nào
 * cho nó và `GET /api/mentor/contests` cũng không trả (cột `status` ở đó là
 * nháp/xuất bản, việc khác hẳn). Dùng lại đúng bộ mã của src/pages/ContestPage.tsx
 * để member và mentor gọi cùng một tên cho cùng một thứ.
 */
export type ContestPhase = 'sap-dien-ra' | 'dang-dien-ra' | 'da-ket-thuc'

export const PHASE_LABEL: Record<ContestPhase, string> = {
  'sap-dien-ra': 'Sắp diễn ra',
  'dang-dien-ra': 'Đang diễn ra',
  'da-ket-thuc': 'Đã kết thúc',
}

/**
 * Ba chip này từng là thang slate kèm cặp `dark:` — bản quét đợt 2 bỏ sót vì script
 * chỉ duyệt `*.tsx`, còn đây là `.ts`.
 *
 * Cặp `dark:` biên dịch thành `@media (prefers-color-scheme)`, mà app đổi theme
 * bằng `[data-theme]` (src/lib/theme.ts). Nên chip nghe HỆ ĐIỀU HÀNH chứ không
 * nghe nút đổi theme: app tối + OS sáng cho ra mảng gần trắng giữa nền tối, và
 * ngược lại. Nay dùng token nên nó theo đúng theme đang bật.
 */
export const PHASE_CLASS: Record<ContestPhase, string> = {
  'sap-dien-ra': 'border border-line-strong text-ink-4',
  'dang-dien-ra': 'border border-moss text-moss',
  'da-ket-thuc': 'border border-line text-ink-5',
}

export function contestPhase(startAt: string, endAt: string, now: number = Date.now()): ContestPhase {
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return 'sap-dien-ra'
  if (now < start) return 'sap-dien-ra'
  if (now <= end) return 'dang-dien-ra'
  return 'da-ket-thuc'
}
