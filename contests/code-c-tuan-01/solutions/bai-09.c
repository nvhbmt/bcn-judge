#include <stdio.h>

int main(void) {
    double truoc, moigio;
    long gio;
    scanf("%lf %lf %ld", &truoc, &moigio, &gio);
    printf("%.2f\n", (truoc + moigio * gio) * 0.93);
    return 0;
}
