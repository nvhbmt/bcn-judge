/**
 * Cổng xuất bản (FR-D6 v0.5) — chỗ dễ làm sai nhất của khu mentor.
 *
 * Server trả 409 cho nhiều lý do khác nhau và CHỈ MỘT lý do được phép đi tiếp:
 *
 *   • `publish_validation_failed` — cổng MỀM. Bài chưa được kiểm bằng lời giải
 *     mẫu trên bộ testcase hiện hành. FR-D6 chốt "xuất bản không bị chặn, nhưng
 *     phải xác nhận qua hộp thoại cảnh báo" → gửi lại kèm `confirm: true` là qua.
 *
 *   • `no_problems` / `no_testcases` / `missing_expected` — cổng CỨNG. Server
 *     kiểm ba thứ này TRƯỚC nhánh mềm và không đọc `confirm`, nên gửi lại với
 *     `confirm: true` vẫn 409 y hệt. Hiện nút "Vẫn xuất bản" ở đây là hứa hão:
 *     mentor bấm mãi không xong mà không hiểu vì sao.
 *
 * Nên mặc định của hàm này là KHÔNG cho xác nhận; đúng một mã mở khoá được nút.
 */
import { ApiFailure } from '@/lib/api'

export const SOFT_PUBLISH_CODE = 'publish_validation_failed'

export interface PublishGate {
  code: string
  message: string
  /** true ⇔ gửi lại đúng request đó kèm `confirm: true` sẽ xuất bản được. */
  canConfirm: boolean
}

export function readPublishGate(err: unknown): PublishGate {
  if (err instanceof ApiFailure) {
    return {
      code: err.error.code,
      message: err.error.message,
      // 403 (contest toàn CLB), 404, 400… đều rơi vào đây với canConfirm=false.
      canConfirm: err.status === 409 && err.error.code === SOFT_PUBLISH_CODE,
    }
  }
  return { code: 'unknown', message: 'Không xuất bản được — thử lại sau.', canConfirm: false }
}

/** Thông điệp cho các mutation không phải xuất bản (lưu, xoá, nhân bản…). */
export function readApiMessage(err: unknown, fallback: string): string {
  return err instanceof ApiFailure ? err.error.message : fallback
}
