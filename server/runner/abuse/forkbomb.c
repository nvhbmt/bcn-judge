/* Fork bomb có điều kiện: input "1" → bomb, input khác → in "ok".
   Cho phép kiểm chứng US-9 ở mức testcase: test bomb nhận RE/TLE, container bị
   coi là nhiễm độc (pids), worker thay container mới và **testcase kế vẫn được
   chấm bình thường** (design.md §3.2 "bão hoà pids"). */
#include <stdio.h>
#include <unistd.h>

int main(void) {
    int flag = 0;
    if (scanf("%d", &flag) != 1) flag = 0;
    if (!flag) {
        printf("ok\n");
        return 0;
    }
    for (;;) {
        if (fork() < 0) {
            /* Hết pid: vẫn quay vòng để giữ namespace bão hoà. */
        }
    }
}
