#include <stdio.h>

int main(void) {
    long n, m;
    scanf("%ld %ld", &n, &m);
    printf("%ld %ld\n", n / 4, m >= 5 ? m * 4 : m * 5);
    return 0;
}
