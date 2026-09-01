# Ghi đĩa: /tmp là tmpfs 16 MB (tính vào cgroup memory) + ulimit fsize.
# Ghi 200 MB phải thất bại chứ không được đầy đĩa host.
chunk = b"A" * (1024 * 1024)
written = 0
try:
    with open("/tmp/flood.bin", "wb") as fh:
        for _ in range(200):
            fh.write(chunk)
            fh.flush()
            written += len(chunk)
    print("WROTE", written)
except Exception as exc:
    print("WRITE_FAIL", type(exc).__name__, written)
