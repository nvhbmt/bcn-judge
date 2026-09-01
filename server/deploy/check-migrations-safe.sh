#!/usr/bin/env bash
# Cổng chỉ-additive cho migration (design.md §9).
#
# Lý do: deploy blue/green nghĩa là mã CŨ và mã MỚI chạy đồng thời vài giây. Một
# DROP COLUMN hay RENAME làm mã cũ nổ ngay lập tức. Chỉ hai ngoại lệ đã ghi danh
# trong thiết kế được đi lối tay: composite FK deferrable của teams (ADR-14) và
# DROP unique khi Q17 flip sang "member nhiều team".
set -euo pipefail

cd "$(dirname "$0")/.."
FORBIDDEN='DROP[[:space:]]+(COLUMN|TABLE)|RENAME[[:space:]]+(COLUMN|TO)|ALTER[[:space:]]+COLUMN[[:space:]]+[a-z_]+[[:space:]]+TYPE'
ALLOW_MARK='-- migration-safe: ok'

fail=0
for file in drizzle/*.sql; do
  [ -e "$file" ] || continue
  if grep -qE "$FORBIDDEN" "$file"; then
    if grep -q "$ALLOW_MARK" "$file"; then
      echo "  ! $file có thao tác phá vỡ nhưng đã được đánh dấu duyệt tay"
    else
      echo "  ✗ $file: có DROP/RENAME/ALTER TYPE — mã cũ đang chạy song song sẽ nổ."
      echo "    Nếu cố ý, thêm dòng '$ALLOW_MARK' và deploy ngoài giờ contest."
      fail=1
    fi
  fi
done

[ "$fail" = 0 ] && echo "  ✓ Migration chỉ-additive."
exit "$fail"
