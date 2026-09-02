#include <stdio.h>

int main(void) {
    double t;
    scanf("%lf", &t);
    if (t < 2) printf("Qua lanh\n");
    else if (t <= 8) printf("An toan\n");
    else printf("Qua nong\n");
    return 0;
}
