#include <stdio.h>

int main(void) {
    long tc, ld, tb, bd;
    scanf("%ld %ld %ld %ld", &tc, &ld, &tb, &bd);
    long ly = tc * 13 + ld;
    long banh = tb * 7 + bd;
    printf("%ld %ld %ld\n", ly, banh, ly * 21 + banh * 34 + (tc + tb) * 5);
    return 0;
}
