/** Kiểu dữ liệu thảo luận, khớp serialize ở server/src/routes/member/discussions.ts. */

/** Mốc giờ gọn theo giờ máy người xem: "dd.mm HH:MM". */
export function formatWhen(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export interface Reply {
  id: string
  bodyMd: string
  authorId: string
  authorName: string
  createdAt: string
  editedAt: string | null
  isMine: boolean
  canManage: boolean
}

export interface Thread {
  id: string
  title: string
  bodyMd: string
  authorId: string
  authorName: string
  createdAt: string
  editedAt: string | null
  pinned: boolean
  isMine: boolean
  canManage: boolean
  canPin: boolean
  replies: Reply[]
}

export interface DiscussionData {
  /** Đã mở khoá chưa (đã AC bài hoặc là staff). false = giấu toàn bộ nội dung. */
  canAccess: boolean
  canPost: boolean
  isStaff: boolean
  threads: Thread[]
}
