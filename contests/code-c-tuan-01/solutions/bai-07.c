#include <stdio.h>

int main(void) {
    long x, y;
    scanf("%ld %ld", &x, &y);
    printf("%ld %ld %ld %ld\n", x / 13, x % 13, y / 7, y % 7);
    return 0;
}
