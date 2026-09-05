/**
 * Ghép chuỗi class: bỏ nhánh không dùng, rồi GIẢI XUNG ĐỘT giữa các class cùng nhóm.
 *
 * `clsx` lo phần ghép (chuỗi, mảng, `cond && 'x'`, object). `tailwind-merge` lo phần
 * còn lại: hai class cùng tác động một thuộc tính thì chỉ class ĐỨNG SAU sống sót.
 *
 * Vì sao cần phần thứ hai, chứ không phải chỉ nối chuỗi cho gọn: thứ tự class trong
 * thuộc tính `class` KHÔNG quyết định thắng thua. Cả hai đều được sinh ra, và cái nào
 * thắng là do vị trí của nó trong file CSS mà Tailwind sinh — tức do thứ tự nội bộ của
 * Tailwind, không phải do mình viết. `cn('bg-line', dragging && 'bg-primary/60')` vì
 * thế từng là một lời cầu may: nhìn thì rõ ý "đang kéo thì đổi màu", mà kết quả thật
 * phụ thuộc chỗ khác. Nay `bg-line` bị loại thẳng khi `dragging`, đúng ý đã viết.
 *
 * Hệ quả phải nhớ: đưa `className` từ ngoài vào một component (`<Button className=…>`)
 * nay ĐÈ ĐƯỢC class mặc định cùng nhóm — trước đây thì hên xui. Đó là điều mong muốn,
 * nhưng nó có nghĩa là thứ tự đối số quan trọng: base trước, ghi đè sau.
 *
 * Không cấu hình thêm cho `tailwind-merge`: đã đo trên toàn bộ chuỗi class của repo,
 * kể cả token riêng (`text-(--label)`, `bg-(--tint-earth)`, `bg-primary-soft`) và các
 * class không phải Tailwind (`num`, `chip-do-kho`, `rule-ink`, `split-handle`) —
 * nhóm nào nó không biết thì nó để nguyên, và `text-(--label)` được nhận đúng là MÀU
 * chứ không phải cỡ chữ, nên nó không nuốt `text-[12px]` đứng cạnh.
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export type { ClassValue }

export function cn(...parts: ClassValue[]): string {
  return twMerge(clsx(parts))
}
