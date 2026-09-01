/* RE: truy cập con trỏ NULL → SIGSEGV. */
int main(void) {
    volatile int *p = 0;
    *p = 42;
    return 0;
}
