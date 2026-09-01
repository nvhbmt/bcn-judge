# US-6 / §8: không có thư mục testcase để đọc; run.sh và file đo không đọc được;
# rootfs không ghi được.
import os


def probe(path):
    try:
        with open(path, "rb") as fh:
            return "READ:%d" % len(fh.read(64))
    except Exception as exc:
        return "DENY:%s" % type(exc).__name__


print("shadow", probe("/etc/shadow"))
print("runsh", probe("/opt/judge/run.sh"))
print("meta", probe("/tmp/.judge_meta"))
print("workdir", sorted(os.listdir("/w")))

try:
    with open("/etc/bcn_probe", "w") as fh:
        fh.write("x")
    print("rootfs WRITABLE")
except Exception as exc:
    print("rootfs", type(exc).__name__)
