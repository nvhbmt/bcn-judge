#!/bin/sh
# /opt/judge/run.sh — toàn bộ phần judge chạy bên trong container (design.md §3.2).
#
#   run.sh --cpu <giây> --wall <giây> --out <byte> [--fsize <byte>] -- <argv...>
#
# --fsize là tuỳ chọn: chỉ đặt cho lượt CHẠY. Lúc biên dịch phải để trống để kế
# thừa hard limit của container — tiến trình không đặc quyền không nâng được hard
# limit, mà binary tĩnh lớn hơn trần output rất nhiều (P0 phát hiện).
#
# Chạy dưới root (container), hạ quyền xuống uid 1000 bằng setpriv TRƯỚC khi
# chạy chương trình của member. GNU time nằm NGOÀI setpriv nên số đo do root ghi:
# tiến trình của member không giả mạo được số đo của chính nó.
#
# Luôn exit 0 — kết quả thật nằm ở dòng __JUDGE_META__ cuối cùng trên stderr.
set -u

CPU=1
WALL=5
OUT=8388608
FSIZE=

while [ $# -gt 0 ]; do
  case "$1" in
    --cpu)   CPU=$2;   shift 2 ;;
    --wall)  WALL=$2;  shift 2 ;;
    --out)   OUT=$2;   shift 2 ;;
    --fsize) FSIZE=$2; shift 2 ;;
    --)      shift; break ;;
    *)       printf 'run.sh: tham so la: %s\n' "$1" >&2; exit 64 ;;
  esac
done
[ $# -gt 0 ] || { printf 'run.sh: thieu lenh\n' >&2; exit 64; }

META=/tmp/.judge_meta
ERR=/tmp/.judge_stderr

# /tmp là 1777 nên uid 1000 có thể tạo trước hai file này để ghi đè số đo sau khi
# GNU time đã ghi. Root xoá rồi tạo lại 0600: sticky bit không chặn root, và uid
# 1000 không mở được file 0600 của root. (Siết so với design.md §3.2 — xem README.)
rm -f "$META" "$ERR" 2>/dev/null
: > "$META"
: > "$ERR"
chmod 600 "$META" "$ERR" 2>/dev/null

PRLIMIT_ARGS="--cpu=$CPU --nofile=64 --core=0"
[ -n "$FSIZE" ] && PRLIMIT_ARGS="$PRLIMIT_ARGS --fsize=$FSIZE"

# Hạ bounding set cần CAP_SETPCAP và hành vi khác nhau theo phiên bản util-linux
# (2.38 bỏ qua êm, 2.41 báo lỗi và exit 127). Thăm dò trước rồi mới quyết, và BÁO
# kết quả ra meta ("bset") — hỏng lớp siết an ninh phải nhìn thấy được, không im lặng.
SETPRIV_ARGS="--reuid=1000 --regid=1000 --clear-groups --no-new-privs --inh-caps=-all"
BSET=0
if setpriv $SETPRIV_ARGS --bounding-set=-all true 2>/dev/null; then
  SETPRIV_ARGS="$SETPRIV_ARGS --bounding-set=-all"
  BSET=1
fi

read_oom() {
  awk '/^oom_kill /{print $2; found=1} END{if (!found) print 0}' \
    /sys/fs/cgroup/memory.events 2>/dev/null || echo 0
}

oom0=$(read_oom)
[ -n "$oom0" ] || oom0=0

/usr/bin/time -q -f '%e %U %S %M' -o "$META" \
  timeout -s KILL "$WALL" \
  setpriv $SETPRIV_ARGS \
  prlimit $PRLIMIT_ARGS \
  "$@" 2>"$ERR"
st=$?

# root + CAP_KILL: gặt tiến trình nền / tiến trình lì của member.
# Trong namespace đã bị fork bomb ghim đủ pids thì chính pkill cũng không fork nổi
# — vì vậy worker còn đọc "pids" bên dưới để biết container đã nhiễm độc (§3.2).
pkill -KILL -u 1000 2>/dev/null

oom1=$(read_oom)
[ -n "$oom1" ] || oom1=0
pids=$(cat /sys/fs/cgroup/pids.current 2>/dev/null || echo 0)
[ -n "$pids" ] || pids=0

# stderr của member (đã cắt), rồi tới dòng meta thật.
#
# LẬP LUẬN "dòng giả luôn nằm TRƯỚC dòng thật nên worker chỉ đọc dòng cuối" LÀ SAI.
# Nó đúng về thứ tự nhưng bỏ qua việc dòng thật có tới nơi hay không: ngân sách thu
# stderr của worker đúng bằng 8 KB mà `head` dưới đây cho member đẩy ra, nên member
# xả đủ 8 KB là dòng thật bị cắt mất, chỉ còn dòng GIẢ là dòng __JUDGE_META__ cuối
# cùng. Đo được: cùng một chương trình đốt 1,5 s CPU với giới hạn 1 s, không giả mạo
# ra TLE, có giả mạo ra AC với timeMs=10. Qua được cả MLE ("oom") và RE ("st").
#
# Nay chặn ở hai lớp độc lập:
#   1. Ở ĐÂY: bẻ token trong phần của member, nên trong luồng không thể tồn tại một
#      dòng __JUDGE_META__ nào khác ngoài dòng do root in bên dưới. `sed` chạy SAU
#      `head` nên chỉ phải xử lý tối đa 8 KB, không phải luồng vô hạn.
#   2. Ở worker: sandbox.ts giữ riêng phần ĐUÔI luồng, nên dòng thật luôn về tới nơi
#      dù member xả bao nhiêu. Lớp này còn sửa một lỗi làm phiền người học ngay thẳng:
#      bài ĐÚNG mà in > 8 KB log gỡ lỗi cũng từng mất dòng meta và ăn IE oan.
#
# Hai lớp cố ý không dựa vào nhau: lớp 1 chống cố ý, lớp 2 chống tai nạn, và không
# lớp nào cần hai hằng số ở hai file khác ngôn ngữ phải khớp nhau mới đúng.
#
# THỨ TỰ CHUYỂN HƯỚNG cũng quan trọng. Bản trước viết `2>/dev/null >&2`: shell đặt
# fd2 vào /dev/null TRƯỚC, rồi `>&2` nhân bản fd2 hiện tại vào fd1 — tức là cả hai
# cùng trỏ /dev/null. Hệ quả: stderr của trình biên dịch bị nuốt sạch, mọi bài CE
# chỉ hiện "Biên dịch thất bại." mà không nói lỗi ở đâu.
head -c 8192 "$ERR" 2>/dev/null | sed 's/__JUDGE_META__/__judge_meta__/g' >&2

awk -v st="$st" -v oom0="$oom0" -v oom1="$oom1" -v pids="$pids" -v bset="$BSET" '
  NF == 4 && $1 ~ /^[0-9.]+$/ { e = $1; u = $2; s = $3; m = $4 }
  END {
    if (e == "") { e = 0; u = 0; s = 0; m = 0 }
    printf "\n__JUDGE_META__ {\"st\":%d,\"wall\":%.3f,\"cpu\":%.3f,\"rss_kb\":%d,\"oom\":%d,\"pids\":%d,\"bset\":%d}\n",
           st, e + 0, u + s, m + 0, oom1 - oom0, pids, bset
  }
' "$META" >&2

rm -rf /tmp/.[!.]* /tmp/..?* /tmp/* 2>/dev/null
exit 0
