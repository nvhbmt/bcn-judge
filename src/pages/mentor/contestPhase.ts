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

export const PHASE_CLASS: Record<ContestPhase, string> = {
  'sap-dien-ra': 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  'dang-dien-ra': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  'da-ket-thuc': 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

export function contestPhase(startAt: string, endAt: string, now: number = Date.now()): ContestPhase {
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return 'sap-dien-ra'
  if (now < start) return 'sap-dien-ra'
  if (now <= end) return 'dang-dien-ra'
  return 'da-ket-thuc'
}
