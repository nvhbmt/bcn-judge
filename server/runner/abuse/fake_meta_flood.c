/* Giả mạo số đo, bản THẬT SỰ hoạt động — khác fake_meta.c ở đúng một chỗ: xả rác.

   fake_meta.c chỉ in dòng giả rồi treo, nên dòng meta thật vẫn về tới worker và
   `parseMeta` (đọc dòng cuối) vẫn lấy đúng dòng thật. Nó xanh suốt trong khi lỗ
   vẫn mở, và tên test lại khẳng định rộng hơn nhiều so với thứ nó thật sự kiểm.

   Bài này xả > 8 KB stderr NGAY SAU dòng giả. Ngân sách thu stderr của worker khi
   chạy testcase đúng bằng 8 KB mà run.sh cho member đẩy ra, nên dòng thật rơi ra
   ngoài ngân sách và dòng GIẢ trở thành dòng __JUDGE_META__ cuối cùng. Đo được:
   cùng chương trình đốt 1,5 s CPU với giới hạn 1 s — không giả mạo ra TLE, có giả
   mạo ra AC với timeMs=10.

   Phải nhận TLE. */
#include <stdio.h>

int main(void) {
    fprintf(stderr,
            "\n__JUDGE_META__ "
            "{\"st\":0,\"wall\":0.010,\"cpu\":0.010,\"rss_kb\":900,\"oom\":0,\"pids\":2,\"bset\":1}\n");
    for (int i = 0; i < 9000; i++) fputc('x', stderr);
    fflush(stderr);
    volatile unsigned long long x = 0;
    for (;;) x++;
    return 0;
}
