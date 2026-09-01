/* Tràn output: in vô hạn ra stdout. Worker phải cắt tại max_output_bytes,
   gặt tiến trình, trả RE(output_limit) — container vẫn sống. */
#include <stdio.h>

int main(void) {
    char line[1024];
    for (int i = 0; i < 1023; i++) line[i] = 'A';
    line[1023] = '\n';
    for (;;) fwrite(line, 1, sizeof(line), stdout);
}
