/**
 * Nhãn tiếng Việt + đơn vị cho từng khoá cài đặt (FR-H2).
 *
 * `GET /settings` trả một object PHẲNG toàn khoá snake_case; nếu render thẳng
 * thì admin phải đoán `max_output_bytes` là byte hay KB. Bảng này biến khoá kỹ
 * thuật thành câu tiếng Việt kèm đơn vị, và gom theo nhóm để các giới hạn liên
 * quan nằm cạnh nhau.
 *
 * Khoá lạ (server thêm mới mà FE chưa cập nhật) KHÔNG bị nuốt: `groupSettings`
 * đẩy chúng vào nhóm "Khác" với nhãn là chính tên khoá — thà xấu còn hơn ẩn mất
 * một giới hạn đang có hiệu lực.
 */

export interface SettingMeta {
  label: string
  unit?: string
  /** Đơn vị byte → hiện thêm quy đổi KB/MB cho dễ hình dung. */
  bytes?: boolean
  hint?: string
}

export const SETTING_META: Record<string, SettingMeta> = {
  announcement: {
    label: 'Thông báo toàn hệ thống',
    hint: 'Hiện thành băng ngay dưới thanh trên cho mọi người. Để trống thì không hiện gì.',
  },
  default_time_limit_ms: {
    label: 'Giới hạn thời gian mặc định',
    unit: 'ms',
    hint: 'Wall time = 2 × giá trị này + 2 giây.',
  },
  default_memory_limit_mb: { label: 'Giới hạn bộ nhớ mặc định', unit: 'MB' },
  max_output_bytes: { label: 'Output tối đa mỗi lần chạy', unit: 'byte', bytes: true },
  tle_skip_threshold: {
    label: 'Ngưỡng bỏ qua testcase còn lại khi TLE',
    unit: 'testcase',
    hint: '0 = luôn chấm hết mọi testcase.',
  },

  max_source_bytes: { label: 'Kích thước tối đa của mã nguồn', unit: 'byte', bytes: true },
  max_custom_input_bytes: { label: 'Kích thước tối đa input tự nhập', unit: 'byte', bytes: true },

  submissions_per_minute: { label: 'Số lần nộp bài mỗi phút', unit: 'lần/phút' },
  runs_per_minute: { label: 'Số lần chạy thử mỗi phút', unit: 'lần/phút' },
  max_pending_submissions_per_user: { label: 'Số bài chờ chấm tối đa mỗi người', unit: 'bài' },

  compile_time_limit_ms: { label: 'Giới hạn thời gian biên dịch', unit: 'ms' },
  compile_memory_mb: { label: 'Bộ nhớ cho biên dịch', unit: 'MB' },

  max_testcase_file_bytes: { label: 'Kích thước tối đa mỗi tệp testcase', unit: 'byte', bytes: true },
  max_testcases_total_bytes_per_problem: {
    label: 'Tổng dung lượng testcase mỗi bài',
    unit: 'byte',
    bytes: true,
  },
  max_zip_bytes: { label: 'Kích thước tối đa tệp zip tải lên', unit: 'byte', bytes: true },

  judge_paused: {
    label: 'Tạm dừng nhận bài nộp',
    hint: 'Bật thì member vẫn đọc đề và lưu nháp, chỉ không nộp được. Cũng bật/tắt được ở trang Tình trạng chấm.',
  },
}

interface Group {
  title: string
  keys: string[]
}

const GROUPS: Group[] = [
  {
    title: 'Giới hạn chấm bài mặc định',
    keys: ['default_time_limit_ms', 'default_memory_limit_mb', 'max_output_bytes', 'tle_skip_threshold'],
  },
  { title: 'Bài nộp của member', keys: ['max_source_bytes', 'max_custom_input_bytes'] },
  {
    title: 'Chống quá tải',
    keys: ['submissions_per_minute', 'runs_per_minute', 'max_pending_submissions_per_user'],
  },
  { title: 'Biên dịch', keys: ['compile_time_limit_ms', 'compile_memory_mb'] },
  {
    title: 'Testcase mentor tải lên',
    keys: ['max_testcase_file_bytes', 'max_testcases_total_bytes_per_problem', 'max_zip_bytes'],
  },
  // `announcement` là khoá cài đặt duy nhất mang CHỮ. Trước đây nó không có tên trong
  // bảng này nên rơi vào nhóm "Khác" ở tận cuối trang — cùng chỗ với khoá server thêm
  // mà FE chưa biết, tức là chỗ nói "không rõ cái này là gì". Nó thuộc về vận hành,
  // đứng cạnh công tắc tạm dừng chấm.
  { title: 'Vận hành', keys: ['announcement', 'judge_paused'] },
]

export interface RenderedGroup {
  title: string
  keys: string[]
}

/** Gom khoá theo nhóm, giữ lại mọi khoá lạ ở cuối. */
export function groupSettings(settings: Record<string, unknown>): RenderedGroup[] {
  const present = new Set(Object.keys(settings))
  const groups: RenderedGroup[] = []

  for (const group of GROUPS) {
    const keys = group.keys.filter((key) => present.has(key))
    if (keys.length > 0) groups.push({ title: group.title, keys })
  }

  const known = new Set(GROUPS.flatMap((g) => g.keys))
  const rest = [...present].filter((key) => !known.has(key)).sort()
  if (rest.length > 0) groups.push({ title: 'Khác', keys: rest })

  return groups
}

export function metaFor(key: string): SettingMeta {
  return SETTING_META[key] ?? { label: key }
}

/** "65536 byte" một mình vô nghĩa; thêm "≈ 64 KB" thì đọc được ngay. */
export function humanBytes(value: number): string {
  if (value >= 1024 * 1024) return `≈ ${(value / (1024 * 1024)).toFixed(value % (1024 * 1024) === 0 ? 0 : 1)} MB`
  if (value >= 1024) return `≈ ${(value / 1024).toFixed(value % 1024 === 0 ? 0 : 1)} KB`
  return `${value} byte`
}
