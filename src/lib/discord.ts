/**
 * Lời tiếng Việt cho mã lý do mà `/auth/discord/callback` gắn vào URL.
 *
 * Server chỉ trả MÃ chứ không trả câu chữ, vì callback là một cú điều hướng của
 * trình duyệt — không có chỗ nào đặt JSON. Ánh xạ mã → câu để ở đây, chung cho màn
 * đăng nhập lẫn màn tài khoản, đỡ phải chép hai bản rồi lệch nhau.
 */
export const DISCORD_REASON: Record<string, string> = {
  tat: 'Đăng nhập bằng Discord chưa được bật trên hệ thống này.',
  state: 'Phiên đăng nhập Discord đã hết hạn hoặc không hợp lệ. Bấm lại từ đầu.',
  tu_choi: 'Bạn đã huỷ ở màn Discord.',
  loi: 'Không lấy được thông tin từ Discord. Thử lại sau ít phút.',
  chua_gan:
    'Tài khoản Discord này chưa gắn với tài khoản nào ở đây. Đăng nhập bằng mật khẩu rồi vào trang Tài khoản để gắn, hoặc liên hệ mentor.',
  gan_nguoi_khac: 'Tài khoản Discord này đã gắn với một tài khoản khác.',
  bi_khoa: 'Tài khoản đã bị khoá.',
  da_gan: 'Đã gắn Discord vào tài khoản.',
}

/** `da_gan` là tin vui, còn lại là hỏng — dùng để chọn màu. */
export function discordOk(reason: string): boolean {
  return reason === 'da_gan'
}
