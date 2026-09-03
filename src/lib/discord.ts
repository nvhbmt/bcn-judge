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
  ngoai_server:
    'Tài khoản Discord này không ở trong server Discord của CLB. Vào server rồi thử lại, hoặc liên hệ mentor.',
  thieu_vai_tro:
    'Bạn đang ở trong server Discord nhưng chưa có vai trò thành viên CLB. Nhờ mentor gán vai trò rồi thử lại.',
  // Không gộp vào 'ngoai_server': người dùng không làm gì sai, và cách xử cũng khác
  // hẳn — chờ rồi thử lại, chứ không phải đi xin vào server.
  khong_kiem_duoc: 'Chưa hỏi được Discord để kiểm tra tư cách thành viên. Thử lại sau ít phút.',
}

/** `da_gan` là tin vui, còn lại là hỏng — dùng để chọn màu. */
export function discordOk(reason: string): boolean {
  return reason === 'da_gan'
}
