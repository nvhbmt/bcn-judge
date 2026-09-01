-- FR-J6 (S): leader để lại ghi chú nhắc nhở cho một thành viên; thành viên đó
-- thấy thông báo trong app; mentor/admin xem được.
-- Chỉ-additive: một bảng mới, không đụng bảng cũ (§9 check-migrations-safe.sh).

CREATE TABLE team_notes (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  team_id        text NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  author_id      text NOT NULL REFERENCES users (id),
  target_user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body           text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  read_at        timestamptz
);

-- Đường nóng: "ghi chú chưa đọc của tôi" ở mỗi lần mở app.
CREATE INDEX team_notes_target_idx ON team_notes (target_user_id, created_at DESC);
CREATE INDEX team_notes_team_idx ON team_notes (team_id, created_at DESC);
