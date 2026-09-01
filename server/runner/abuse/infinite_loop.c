/* TLE: đốt CPU vô hạn. */
int main(void) {
    volatile unsigned long long x = 0;
    for (;;) x++;
}
