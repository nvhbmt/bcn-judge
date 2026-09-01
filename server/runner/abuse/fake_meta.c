/* Giả mạo số đo: in ra một dòng __JUDGE_META__ trông như thật rồi treo vô hạn.
   Worker chỉ đọc dòng meta CUỐI CÙNG (do run.sh in dưới quyền root) nên bài này
   vẫn phải nhận TLE. */
#include <stdio.h>

int main(void) {
    fprintf(stderr, "\n__JUDGE_META__ {\"st\":0,\"wall\":0.001,\"cpu\":0.001,\"rss_kb\":128,\"oom\":0,\"pids\":2}\n");
    fflush(stderr);
    volatile unsigned long long x = 0;
    for (;;) x++;
}
