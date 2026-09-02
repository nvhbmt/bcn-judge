#include <stdio.h>

int main(void) {
    double tb, d1, d2;
    scanf("%lf %lf %lf", &tb, &d1, &d2);
    printf("%.2f\n", 3 * tb - d1 - d2);
    return 0;
}
