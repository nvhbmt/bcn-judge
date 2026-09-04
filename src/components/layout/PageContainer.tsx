/**
 * Khung bọc chuẩn của MỌI trang dạng tài liệu (danh sách, biểu mẫu, bảng).
 *
 * Có nó vì bốn trang mà admin/mentor dùng hàng ngày từng có bốn bề rộng khác nhau
 * (3xl · 4xl · 5xl · 6xl) và ba kiểu padding, nên chuyển trang là nội dung nhảy ngang
 * — rõ nhất ở cụm quản trị, nơi thanh điều hướng đứng yên trên bốn trang rồi trượt
 * đúng một trang. Bề rộng là quyết định của HỆ THỐNG, không phải của từng trang, nên
 * nó phải nằm ở đúng một chỗ.
 *
 * KHÔNG tự cuộn: khung route ở `App.tsx` đã có `min-h-0 flex-1 overflow-auto`. Trang
 * nào thêm `h-full overflow-y-auto` là dựng thêm một vùng cuộn lồng trong vùng cuộn —
 * thanh cuộn nhảy chỗ giữa các trang, và cuộn bằng bàn phím chạm đáy sớm.
 *
 * Trang bố cục toàn màn hình (màn làm bài, trang contest, trình soạn bài) KHÔNG dùng
 * component này: chúng chia khung theo chiều cao và tự quản vùng cuộn của mình.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function PageContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-5xl px-7 py-8', className)}>{children}</div>
}
