-- Thảo luận cho từng BÀI (problem): mỗi bài một khu hỏi/đáp, thread một cấp.
-- Chỉ-additive: hai bảng mới, không đụng bảng cũ (§9 check-migrations-safe.sh).
--
-- Gắn vào problem_id (bài dùng chung) chứ không vào item: một bài luyện xuất hiện ở
-- nhiều khoá vẫn chung một khu thảo luận. An toàn contest KHÔNG dựa vào bảng này mà ở
-- tầng quyền (chỉ ai ĐÃ AC bài mới đọc/đăng — xem routes/member/discussions.ts), nên
-- không cần cột phân biệt ngữ cảnh.

CREATE TABLE discussion_threads (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  problem_id text NOT NULL REFERENCES problems (id) ON DELETE CASCADE,
  author_id  text NOT NULL REFERENCES users (id),
  title      text NOT NULL,
  body_md    text NOT NULL,
  pinned     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at  timestamptz
);

-- Đường nóng: mở tab Thảo luận của một bài → ghim lên trước, mới nhất trước.
CREATE INDEX discussion_threads_problem_idx ON discussion_threads (problem_id, pinned DESC, created_at DESC);

CREATE TABLE discussion_replies (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  thread_id  text NOT NULL REFERENCES discussion_threads (id) ON DELETE CASCADE,
  author_id  text NOT NULL REFERENCES users (id),
  body_md    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at  timestamptz
);

CREATE INDEX discussion_replies_thread_idx ON discussion_replies (thread_id, created_at);
