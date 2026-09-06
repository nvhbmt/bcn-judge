import { BookOpen, CircleHelp, FileText, History, MessagesSquare, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Năm mục của thanh icon (FR-E7).
 *
 * Đây là LỚP TAB DUY NHẤT của màn làm bài. Bản v2 bỏ cột giáo trình dạng menu chữ và
 * thay bằng thanh icon 56px chính là để còn một lớp: trước đó màn hình có thanh icon
 * cho Giáo trình/BXH/Trợ giúp CỘNG một dải tab Đề bài/Bài nộp bên dưới, nên người
 * dùng phải nhớ mình đang ở lớp nào. Nay "Đề bài" và "Bài nộp" cũng là hai icon, và
 * khung nội dung chỉ có một dòng tiêu đề nói đang xem gì.
 *
 * Bốn icon đầu theo đúng bản vẽ (file-text · history · book-open · trophy · circle-help).
 */
export type RailKey = 'de-bai' | 'bai-nop' | 'giao-trinh' | 'bang-xep-hang' | 'thao-luan' | 'tro-giup'

export interface RailDef {
  key: RailKey
  label: string
  icon: ReactNode
  atBottom?: boolean
}

export const RAIL_ITEMS: RailDef[] = [
  { key: 'de-bai', label: 'Đề bài', icon: <FileText size={19} /> },
  { key: 'bai-nop', label: 'Bài nộp', icon: <History size={19} /> },
  { key: 'giao-trinh', label: 'Giáo trình', icon: <BookOpen size={19} /> },
  { key: 'bang-xep-hang', label: 'Bảng xếp hạng', icon: <Trophy size={19} /> },
  // Xuống đáy thanh: "Trợ giúp" nói về chính giao diện, không phải về bài đang làm —
  // xếp lẫn giữa các mục nội dung thì nó trông như một panel nội dung nữa.
  { key: 'tro-giup', label: 'Trợ giúp', icon: <CircleHelp size={19} />, atBottom: true },
]

export const RAIL_LABEL: Record<RailKey, string> = {
  'de-bai': 'Đề bài',
  'bai-nop': 'Bài nộp',
  'giao-trinh': 'Giáo trình',
  'bang-xep-hang': 'Bảng xếp hạng',
  'thao-luan': 'Thảo luận',
  'tro-giup': 'Trợ giúp',
}

/**
 * Rail cho BÀI LUYỆN của khoá: thêm "Thảo luận" (ngay trước "Trợ giúp" ở đáy).
 *
 * KHÔNG dùng trong contest — thảo luận dễ thành kênh mách nước lúc thi, nên workspace
 * chỉ lắp rail này khi đang ở bài luyện (xem WorkspacePage). An toàn thật nằm ở tầng
 * quyền (chỉ ai đã AC mới đọc/đăng), đây chỉ là ẩn lối vào cho gọn.
 */
export const RAIL_ITEMS_DISCUSSION: RailDef[] = [
  ...RAIL_ITEMS.filter((i) => !i.atBottom),
  { key: 'thao-luan', label: 'Thảo luận', icon: <MessagesSquare size={19} /> },
  ...RAIL_ITEMS.filter((i) => i.atBottom),
]

/**
 * Rail cho một BÀI ĐỌC: bỏ "Bài nộp", và "Đề bài" đổi tên thành "Bài đọc".
 *
 * Bài đọc không có bài nộp nào để liệt kê — panel đó gọi API bằng chính itemId này và
 * chỉ nhận về 404. Một icon dẫn tới khung trống thì thà không có.
 */
export const RAIL_ITEMS_LESSON: RailDef[] = RAIL_ITEMS.filter((i) => i.key !== 'bai-nop').map((i) =>
  i.key === 'de-bai' ? { ...i, label: 'Bài đọc' } : i,
)
