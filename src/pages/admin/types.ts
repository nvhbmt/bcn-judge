/**
 * Bản sao kiểu của các route `/api/admin/*` (mẫu imath: FE giữ bản sao, không
 * import từ server). Mỗi trường ở đây khớp đúng cột mà handler `select`, nên khi
 * server đổi shape thì `tsc` ở FE gãy — đó là mục đích.
 */
import type { Role } from '@/types/api'

// ── Tài khoản (FR-A2/A3/A4) ────────────────────────────────────────────────

export interface AdminUser {
  id: string
  email: string
  username: string | null
  displayName: string
  role: Role
  disabled: boolean
  mustChangePassword: boolean
  lastLogin: string | null
  createdAt: string
}

/** `POST /users` và `POST /users/:id/reset-password` đều trả mật khẩu MỘT LẦN. */
export interface UserWithSecret {
  id: string
  email: string
  role?: Role
  initialPassword: string
}

export interface ImportRow {
  line: number
  email: string
  /** 'created' | 'invalid' | 'failed' — server không đóng khung union nên để string. */
  status: string
  password?: string
  message?: string
}

export interface ImportReport {
  created: number
  failed: number
  results: ImportRow[]
}

// ── Khoá học (FR-B1/B2/B3) ─────────────────────────────────────────────────

export type CourseStatus = 'draft' | 'open' | 'archived'

/** Dòng của `GET /courses`. Cố ý KHÔNG có `descriptionMd`: handler không select nó. */
export interface AdminCourse {
  id: string
  code: string
  name: string
  status: CourseStatus
  selfEnroll: boolean
  createdAt: string
  mentorCount: number
  memberCount: number
}

/** Bản đầy đủ từ `PATCH /courses/:id` (`.returning()`) hoặc `GET /api/mentor/courses/:id`. */
export interface CourseDetail extends Omit<AdminCourse, 'mentorCount' | 'memberCount'> {
  descriptionMd: string | null
}

export interface CoursePayload {
  code: string
  name: string
  descriptionMd?: string
  status?: CourseStatus
  selfEnroll?: boolean
}

export interface CourseMentor {
  id: string
  email: string
  displayName: string
}

export interface CourseEnrollment {
  id: string
  email: string
  displayName: string
  status: string
  enrolledAt: string
}

/** Kết quả dán danh sách email (US-1) — ba nhóm phải hiển thị tách bạch. */
export interface EnrollReport {
  enrolled: number
  missing: string[]
  notMember: string[]
}

// ── Team (FR-J1) ───────────────────────────────────────────────────────────

export interface AdminTeam {
  id: string
  name: string
  descriptionMd: string | null
  leaderId: string
  leaderName: string
  memberCount: number
  /** Trả kèm trong chính lượt gọi danh sách — xem routes/admin/teams.ts. */
  members: { id: string; displayName: string; isLeader: boolean }[]
}

// ── Hệ thống (FR-H1/H2) ────────────────────────────────────────────────────

/**
 * `GET /languages` đọc thô từ Postgres nên `timeFactor` về dạng CHUỖI (cột
 * `numeric`), còn `PUT /languages/:id` lại đòi `z.number()`. Kiểu ở đây nói đúng
 * sự thật của phía đọc; `toLanguagePayload` lo việc ép kiểu trước khi ghi.
 */
export interface Language {
  id: string
  name: string
  versionLabel: string | null
  image: string
  sourceFilename: string
  compileArgv: string[] | null
  runArgv: string[]
  timeFactor: string | number
  memoryExtraMb: number
  cmMode: string | null
  enabled: boolean
  position: number | null
}

/**
 * Giá trị cài đặt: số, cờ, HOẶC chữ. Vế chữ có từ FR-H5 (`announcement`) — trước đó
 * mọi khoá đều là số hoặc cờ, nên form chỉ có hai nhánh render và một chuỗi lọt vào
 * ô `type="number"` là gõ không vào được mà không có gì báo.
 */
export type SettingsMap = Record<string, number | boolean | string>
