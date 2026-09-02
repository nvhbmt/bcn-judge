#include <stdio.h>

int main(void) {
    long s;
    scanf("%ld", &s);
    printf("%ld:%ld:%ld\n", s / 3600, s % 3600 / 60, s % 60);
    return 0;
}
