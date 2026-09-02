#include <stdio.h>

int main(void) {
    double l;
    long n;
    scanf("%lf %ld", &l, &n);
    printf("%.2f\n", 1.75 * n * l - 2.7);
    return 0;
}
