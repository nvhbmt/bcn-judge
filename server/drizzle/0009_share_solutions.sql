-- Lời giải chia sẻ (FR-K v0.8): member đã AC một bài xem được bài AC tốt nhất của người
-- khác. Cột này là công tắc của CHÍNH CHỦ — tắt thì bài của mình biến khỏi danh sách của
-- người khác (mentor/admin vẫn thấy qua đường mentor như trước).
--
-- Mặc định BẬT (opt-out): ban nội bộ 120 người, mục tiêu là học lẫn nhau; mặc định tắt
-- thì mục "Lời giải" trống suốt tháng đầu và không ai biết có công tắc để bật.
-- Chỉ-additive (§9 check-migrations-safe.sh).
ALTER TABLE users ADD COLUMN share_solutions boolean NOT NULL DEFAULT true;
