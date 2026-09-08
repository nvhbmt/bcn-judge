/**
 * Kiểu BXH toàn cục + chuẩn hoá về một hàng chung cho bục và bảng.
 *
 * Server trả hai dạng (cá nhân / team) khác tên trường (userId/displayName vs
 * id/name/memberCount, isMe vs isMine). `LbEntry` gộp lại để Podium và bảng chỉ cần
 * biết MỘT hình dạng — chỗ khác nhau duy nhất giữa hai chế độ là dòng phụ `meta`.
 */
export type LbScope = 'individual' | 'team'
export type LbWindow = 'week' | 'month' | 'all'
/** Nguồn điểm (v0.8): bài luyện, contest, hay cộng cả hai. */
export type LbSource = 'practice' | 'contest' | 'total'

export interface IndividualRow {
  rank: number
  userId: string
  displayName: string
  acCount: number
  totalPoints: number
  /** Hai vế của tổng — server cũ chưa trả thì undefined. */
  practicePoints?: number
  contestPoints?: number
  isMe: boolean
}

export interface TeamRow {
  rank: number
  id: string
  name: string
  acCount: number
  totalPoints: number
  practicePoints?: number
  contestPoints?: number
  memberCount: number
  isMine: boolean
}

/** Hàng đã chuẩn hoá cho hiển thị. */
export interface LbEntry {
  rank: number
  key: string
  name: string
  acCount: number
  totalPoints: number
  /** Vế bài luyện / contest của tổng; null khi server không tách. */
  practicePoints: number | null
  contestPoints: number | null
  /** Dòng phụ dưới tên (chỉ team: "5 người"); null với cá nhân. */
  meta: string | null
  isMe: boolean
}

export function toEntries(scope: LbScope, rows: IndividualRow[] | TeamRow[]): LbEntry[] {
  if (scope === 'team') {
    return (rows as TeamRow[]).map((r) => ({
      rank: r.rank,
      key: r.id,
      name: r.name,
      acCount: r.acCount,
      totalPoints: r.totalPoints,
      practicePoints: r.practicePoints ?? null,
      contestPoints: r.contestPoints ?? null,
      meta: `${r.memberCount} người`,
      isMe: r.isMine,
    }))
  }
  return (rows as IndividualRow[]).map((r) => ({
    rank: r.rank,
    key: r.userId,
    name: r.displayName,
    acCount: r.acCount,
    totalPoints: r.totalPoints,
    practicePoints: r.practicePoints ?? null,
    contestPoints: r.contestPoints ?? null,
    meta: null,
    isMe: r.isMe,
  }))
}
