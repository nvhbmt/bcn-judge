-- Bài dạng FUNCTION (kiểu LeetCode): người học chỉ viết một hàm, hệ thống ghép
-- với một "harness" do mentor soạn rồi biên dịch cả hai thành một chương trình.
--
-- Vì sao KHÔNG đổi gì ở tầng sandbox: chương trình sau khi ghép vẫn đọc stdin và
-- ghi stdout y hệt bài stdio. Toàn bộ hàng đợi, worker, chấm điểm, xếp hạng,
-- serializer không phân biệt được hai dạng — và đó là chủ ý.
--
-- Chỉ-additive (§9 check-migrations-safe.sh): bốn cột mới, đều có mặc định hoặc
-- cho phép NULL, nên bản cũ của server vẫn chạy được trên schema này.

ALTER TABLE problems
  ADD COLUMN kind text NOT NULL DEFAULT 'stdio' CHECK (kind IN ('stdio', 'function')),
  -- {languageId: mã nguồn harness}. Cùng hình dạng với starter_code, và CHỈ mentor
  -- đọc được: harness lộ ra là lộ luôn cách bài được kiểm.
  ADD COLUMN harness jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE languages
  -- Tên file chứa mã của NGƯỜI HỌC khi ở dạng function; harness chiếm chỗ
  -- source_filename (main.c, Main.java…) vì nó mới là điểm vào của chương trình.
  -- NULL = ngôn ngữ này chưa hỗ trợ dạng function, route nộp bài từ chối sớm.
  ADD COLUMN function_source_filename text,
  -- NULL = dùng lại compile_argv. Cần riêng vì vài ngôn ngữ phải nêu đích danh cả
  -- hai file: javac cần Main.java + Solution.java, py_compile cần kiểm cả
  -- solution.py thì lỗi cú pháp của người học mới thành CE thay vì RE.
  ADD COLUMN compile_argv_function jsonb;

-- Bài dạng function mà thiếu harness thì không chấm được. Ràng buộc này để DB
-- giữ, không để guard ở API giữ: một bản ghi sai ở đây là mọi bài nộp thành IE.
ALTER TABLE problems
  ADD CONSTRAINT problems_function_needs_harness
  CHECK (kind <> 'function' OR harness <> '{}'::jsonb);
