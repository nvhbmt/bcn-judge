-- C coi "gọi hàm thiếu khai báo" (thiếu #include) là LỖI, không phải cảnh báo.
-- Trước đây gcc chỉ cảnh báo implicit-declaration/implicit-int rồi exit 0, nên một
-- bài thiếu <stdio.h> vẫn biên dịch được, chạy được và ra AC — người dùng coi đó là
-- "lỗi biên dịch mà vẫn chấm". Nay hai cờ -Werror biến đúng nhóm cảnh báo đó thành
-- lỗi → verdict CE → không chấm test nào. Cảnh báo lành tính (biến thừa…) vẫn cho qua.
--
-- C++ (g++) vốn đã coi định danh chưa khai là lỗi cứng, không cần đụng.
-- Guard: chỉ vá dòng c11 CHƯA có cờ, để chạy lại migration không nhân đôi.
UPDATE languages
SET compile_argv = jsonb_build_array(
  'gcc', '-std=c11', '-Werror=implicit-function-declaration', '-Werror=implicit-int',
  '-O2', '-pipe', '-static', '-s', '-o', '/w/prog', 'main.c', '-lm'
)
WHERE id = 'c11'
  AND NOT (compile_argv @> '["-Werror=implicit-function-declaration"]'::jsonb);
