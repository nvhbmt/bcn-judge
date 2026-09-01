# Kiểm chứng half-close/EOF của stdin qua Docker exec API — rủi ro P0 có tên
# (design.md §3.2, §12 rủi ro #1). Chương trình đọc TỚI EOF; nếu worker không
# half-close được thì nó treo tới hết wall time và ca này thành TLE.
import sys

data = sys.stdin.buffer.read()
print(len(data))
