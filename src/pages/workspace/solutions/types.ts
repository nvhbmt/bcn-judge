/** Kiểu dữ liệu mục "Lời giải", khớp serialize ở server/src/routes/member/solutions.ts. */

export interface PeerSolution {
  id: string
  userId: string
  authorName: string
  avatarUrl: string | null
  languageId: string
  timeMsMax: number | null
  memoryKbMax: number | null
  sourceBytes: number
  receivedAt: string
  isMine: boolean
  /** Chỉ ở đường chi tiết và ở bài của chính mình. */
  source?: string
}

export interface SolutionsData {
  canAccess: boolean
  reason: 'not_solved' | 'contest_embargo' | null
  embargoUntil: string | null
  mine: PeerSolution | null
  reference: { languageId: string | null; source: string } | null
  peers: PeerSolution[]
}

export type SolutionSort = 'time' | 'memory' | 'recent'

/** Byte → chuỗi gọn cho dung lượng mã nguồn. */
export function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`
}
