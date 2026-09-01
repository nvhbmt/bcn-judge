/* MLE: cấp phát và CHẠM vào 400 MB — vượt trần cgroup sau khi thu hẹp lồng.
   Ca này đồng thời xác minh phase 3 (`docker update --memory`) thật sự có hiệu lực:
   nếu container vẫn còn ở cỡ biên dịch (1 GB) thì chương trình chạy trót lọt và
   ca test sẽ đỏ. */
#include <stdlib.h>
#include <stdio.h>
#include <string.h>

#define CHUNK (16 * 1024 * 1024)

int main(void) {
    for (int i = 0; i < 25; i++) {
        char *p = (char *) malloc(CHUNK);
        if (!p) { printf("malloc failed at %d\n", i); return 2; }
        memset(p, i + 1, CHUNK);
    }
    printf("allocated 400MB\n");
    return 0;
}
