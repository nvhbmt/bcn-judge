#include <stdio.h>

int main(void) {
    long long a, b, c;
    scanf("%lld %lld %lld", &a, &b, &c);
    printf("%lld %lld %lld\n", a + b + c, a - b - c, a * b * c);
    return 0;
}
