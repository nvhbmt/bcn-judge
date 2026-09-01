/**
 * Dịch lỗi API sang thông điệp hành động được.
 *
 * Vì sao cần lớp này: các mã 409 quan trọng nhất của trang quản trị bắt nguồn từ
 * BẤT BIẾN CỦA DATABASE (ADR-14: mỗi member ≤ 1 team, leader ∈ team). Server đã
 * có câu tiếng Việt, nhưng câu đó chỉ nói *cái gì sai* — admin còn cần biết
 * *làm gì tiếp*. Ghép hai vế lại thì một 409 thành hướng dẫn thay vì ngõ cụt.
 */
import { ApiFailure } from '@/lib/api'

export function failureCode(err: unknown): string {
  return err instanceof ApiFailure ? err.error.code : 'unknown'
}

/** Câu chỉ dẫn bước tiếp theo cho từng mã xung đột; không có thì trả về null. */
const NEXT_STEP: Record<string, string> = {
  // FR-J1 — hai bất biến do DB giữ.
  already_in_team: 'Gỡ thành viên khỏi team hiện tại trước, rồi thêm lại vào team này.',
  leader_must_be_member:
    'Leader phải nằm trong danh sách thành viên của chính team đó. Hãy thêm người này làm thành viên trước khi đặt làm leader — hoặc nếu đang gỡ leader hiện tại, chuyển quyền leader cho người khác trước.',
  not_a_member_role: 'Team chỉ nhận tài khoản vai trò "Member". Đổi vai trò tài khoản ở trang Tài khoản nếu cần.',
  // FR-B2 — mentor của khoá phải là tài khoản mentor hoặc admin.
  not_staff: 'Nâng vai trò tài khoản này lên "Mentor" ở trang Tài khoản, rồi gán lại.',
  // FR-B1 / FR-A2 — trùng khoá tự nhiên.
  code_taken: 'Chọn mã khác; mã khoá là duy nhất toàn hệ thống.',
  email_taken: 'Email này đã có tài khoản — dùng "Đặt lại mật khẩu" thay vì tạo mới.',
  // FR-A4 — chốt chặn để hệ thống không bao giờ mất admin cuối cùng.
  cannot_demote_self: 'Nhờ một admin khác hạ quyền tài khoản này, hoặc giữ nguyên vai trò admin.',
  rate_limited: 'Đợi một lát rồi thử lại.',
}

export interface FailureNotice {
  message: string
  nextStep: string | null
}

/** Gộp câu của server với bước tiếp theo. `fallback` dùng khi mất mạng. */
export function describeFailure(err: unknown, fallback = 'Thao tác không thành công.'): FailureNotice {
  if (!(err instanceof ApiFailure)) {
    return { message: fallback, nextStep: null }
  }
  return {
    message: err.error.message || fallback,
    nextStep: NEXT_STEP[err.error.code] ?? null,
  }
}

/**
 * Tách chuỗi email dán từ Excel/Google Sheets/Zalo (US-1).
 *
 * Tách theo xuống dòng, dấu phẩy, chấm phẩy, tab VÀ khoảng trắng — người dán
 * thật hiếm khi dùng đúng một loại. Trùng lặp bị loại ngay tại client để con số
 * "đã ghi danh" mà server trả về khớp với số dòng admin nhìn thấy.
 */
export function parseEmailList(raw: string): string[] {
  const parts = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return [...new Set(parts)]
}

/** Email hợp lệ theo `z.string().email()` — lọc trước để không bị 400 cả lô. */
export function splitValidEmails(emails: string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = []
  const invalid: string[] = []
  for (const email of emails) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) valid.push(email)
    else invalid.push(email)
  }
  return { valid, invalid }
}
