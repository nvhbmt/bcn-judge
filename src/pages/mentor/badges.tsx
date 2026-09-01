/**
 * Trạng thái kiểm testcase của một bài (FR-D6) — dùng chung cho danh sách và trình soạn.
 *
 * Ba trạng thái chứ không hai: "chưa có testcase" phải tách khỏi "chưa kiểm", vì
 * việc phải làm tiếp hoàn toàn khác nhau (tải test lên / bấm kiểm) và cả hai đều
 * chưa xuất bản được. Gộp chung thì mentor nhìn chấm vàng mà không biết làm gì.
 */
export type ValidationState = 'no-testcase' | 'unchecked' | 'checked'

export function validationState(opts: { testcases: number; validated: boolean }): ValidationState {
  if (opts.testcases === 0) return 'no-testcase'
  return opts.validated ? 'checked' : 'unchecked'
}

const STATE = {
  'no-testcase': {
    label: 'Chưa có testcase',
    title: 'Bài chưa có testcase nào — chưa chấm được.',
    className: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  },
  unchecked: {
    label: 'Chưa kiểm',
    title: 'Bộ test hiện tại chưa được lời giải mẫu xác nhận (FR-D6).',
    className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  },
  checked: {
    label: 'Đã kiểm',
    title: 'Lời giải mẫu đã chạy đúng trên toàn bộ bộ test hiện tại.',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  },
} as const

export function ValidationBadge({ state }: { state: ValidationState }) {
  const s = STATE[state]
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${s.className}`} title={s.title}>
      {s.label}
    </span>
  )
}
