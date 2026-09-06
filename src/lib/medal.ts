/**
 * Huy chương cho hạng 1-2-3 — dùng chung giữa trang BXH (bục vinh danh) và các panel
 * nhỏ (trang chủ, workspace, team). Một nguồn duy nhất để vàng/bạc/đồng nhất quán.
 *
 * Trả emoji vì nó tự mang màu vàng/bạc/đồng — hệ token không có "bạc"/"đồng", và
 * dựng thêm hai màu chỉ để đây dùng thì lợi bất cập hại.
 */
export function medal(rank: number): string | null {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
}
