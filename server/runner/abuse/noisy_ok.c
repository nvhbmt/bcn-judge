/* Bài ĐÚNG nhưng in nhiều log gỡ lỗi ra stderr — chuyện xảy ra hằng tuần ở một CLB
   dạy C cho người mới.

   Cùng gốc với fake_meta_flood.c nhưng không hề có ý xấu: khi ngân sách thu stderr
   bị xả tràn, dòng meta thật bị cắt, `parseMeta` trả null và verdict thành IE — thứ
   giao diện trình bày là *lỗi hệ thống*. Đo được: 8000 byte → AC, 9000 byte → IE.
   Tệ hơn, `finish` ghi ie_retry nên nút "chấm lại IE" của admin phát lại đúng bài đó
   và ra đúng IE đó.

   Phải nhận AC. */
#include <stdio.h>

int main(void) {
    for (int i = 0; i < 20000; i++) fputc('d', stderr);
    fflush(stderr);
    printf("ok\n");
    return 0;
}
