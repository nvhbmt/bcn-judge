-- Đăng nhập bằng Discord (FR-A1 mở rộng).
--
-- Discord là một cách XÁC THỰC tài khoản đã có, KHÔNG phải cách tạo tài khoản mới.
-- Chính màn đăng nhập nói vậy: "Chưa có tài khoản? Liên hệ ngay các mentor để được
-- cấp tài khoản." Nếu callback tự tạo user thì bất kỳ ai có Discord đều vào được
-- judge, và vai trò/ghi danh/team — vốn do admin cấp — mất nghĩa.

ALTER TABLE users
  -- Snowflake của Discord: chuỗi số 17-20 ký tự, KHÔNG phải số. Lưu text vì nó vượt
  -- 2^53 nên qua JSON của JavaScript sẽ mất chính xác nếu coi là number.
  ADD COLUMN discord_id text,
  -- Chỉ để HIỆN cho người dùng biết đang gắn với tài khoản Discord nào. Không dùng
  -- để định danh: Discord cho đổi username, còn discord_id thì không đổi.
  ADD COLUMN discord_username text,
  ADD COLUMN discord_linked_at timestamptz;

-- Một tài khoản Discord chỉ gắn được vào MỘT user. Không có ràng buộc này thì hai
-- user cùng trỏ về một Discord, và "đăng nhập bằng Discord" không còn xác định được
-- phải mở phiên cho ai.
--
-- Partial index: NULL nghĩa là "chưa gắn", mà chưa gắn thì có bao nhiêu cũng được.
CREATE UNIQUE INDEX users_discord_id_key ON users (discord_id) WHERE discord_id IS NOT NULL;
