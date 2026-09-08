-- Tự khoá tài khoản khi rời server Discord (quét nền bằng Bot token — auth/discordSweep.ts).
-- Chỉ-additive: hai cột mới trên users, không đụng cột cũ (§9 check-migrations-safe.sh).
--
-- `disabled_reason` phân biệt khoá TAY ('admin') với khoá TỰ ĐỘNG ('discord_kick'), vì
-- hai thứ mở lại theo hai luật khác nhau: admin khoá thì admin mở; rời Discord mà vào
-- lại server rồi đăng nhập bằng Discord thì tự mở. Gộp làm một cờ thì hoặc bộ quét mở
-- nhầm tài khoản admin vừa khoá, hoặc người vào lại server vẫn bị chặn vô thời hạn.
--
-- `disabled_at` để màn quản trị nói "khoá lúc nào" thay vì chỉ "đã khoá".
--
-- NULL ở tài khoản đang bị khoá = khoá tay từ trước khi có cột này — xử như 'admin'.
ALTER TABLE users ADD COLUMN disabled_reason text;
ALTER TABLE users ADD COLUMN disabled_at timestamptz;
