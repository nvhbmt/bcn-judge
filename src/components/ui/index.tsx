/**
 * Bộ UI tối giản tự viết (không kéo thư viện).
 *
 * Ba luật của hệ thiết kế được ép ở đây, vì đây là chỗ mọi màn hình đi qua:
 *   - bo góc 0 (ngoại lệ duy nhất: chấm trạng thái)
 *   - không bóng đổ — cần phân tầng thì dùng đường kẻ hoặc đổi nền một bậc
 *   - mọi con số và verdict dùng mono; nhãn nút ALL-CAPS
 * Xem design-system/readme.md, mục VISUAL FOUNDATIONS.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { VERDICT_LABEL, type Verdict } from '@/types/api'

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'quiet'
type ButtonSize = 'sm' | 'md' | 'lg'

/** `--moss-solid` chỉ tồn tại ở bản sáng; bản tối rơi về `--moss`. */
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--moss-solid,var(--moss))] text-on-accent font-semibold uppercase hover:opacity-90',
  ghost: 'border border-line-strong text-ink-3 hover:bg-surface-sel',
  danger: 'bg-clay text-on-accent font-semibold uppercase hover:opacity-90',
  quiet: 'text-ink-5 hover:text-ink-3',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-[11px] py-[5px] text-[11px]',
  md: 'px-[14px] py-[7px] text-[12px]',
  lg: 'px-4 py-[9px] text-[13px]',
}

/**
 * Class của nút, tách ra để thứ KHÔNG phải `<button>` cũng mang đúng hình dạng đó.
 *
 * Cần nó vì "đi tới trang khác" phải là `<a>`: lồng `<button>` trong `<Link>` là HTML
 * sai, và mất luôn bấm-giữa-chuột, mở tab mới, copy địa chỉ. Trước đây mỗi trang tự
 * chép lại chuỗi class nên chúng trôi lệch nhau từng chút một.
 */
export function buttonClass(variant: ButtonVariant = 'ghost', size: ButtonSize = 'md', extra = ''): string {
  return `inline-flex items-center justify-center gap-2 rounded-none font-mono tracking-[0.06em]
    transition-[background-color,color] duration-[120ms] ease-linear
    disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-5 disabled:opacity-100
    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss
    ${VARIANT[variant]} ${SIZE[size]} ${extra}`
}

export function Button({
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-none font-mono tracking-[0.06em]
        transition-[background-color,color] duration-[120ms] ease-linear
        disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-5 disabled:opacity-100
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss
        ${VARIANT[variant]} ${SIZE[size]} ${className}`}
    />
  )
}

/**
 * Verdict lấy màu từ `--verdict-*`, ánh xạ 1:1 với `VERDICT_TONE` ở tầng dữ liệu.
 * Chữ đặt trên nền mờ cùng tông chứ không phải nền đặc — `--clay` phải đọc được
 * trên chính `--tint-clay`, đó là nền xấu nhất và ngưỡng 4.5:1 đo ở đó.
 */
/**
 * Huy hiệu verdict, HAI CẤP — và cấp là quyết định về mật độ, không phải về thẩm mỹ.
 *
 * `solid` (mặc định): nền đặc, chữ --on-accent. Dùng ở chỗ huy hiệu ĐỨNG MỘT MÌNH —
 * kết quả nộp, thanh editor, báo cáo kiểm. Ở nền sáng, viền 1px + chữ màu gần như
 * tàng hình: màu điểm TỐI hơn nền nên mắt đọc ra là chữ thường, không phải điểm nhấn.
 * Khối đặc thì đọc được ngay vì nó có diện tích.
 *
 * `soft`: nền wash của tông, chữ giữ màu verdict. Dùng trong BẢNG DÀY — dòng kết quả
 * từng testcase, bảng xếp hạng, danh sách bài nộp. Năm mươi khối đặc xếp dọc thành
 * một mảng màu loang, và lúc đó chẳng dòng nào nổi nữa.
 */
export function VerdictBadge({
  verdict,
  pending,
  tone = 'solid',
}: {
  verdict: Verdict | null
  pending?: boolean
  tone?: 'solid' | 'soft'
}) {
  if (!verdict) {
    return (
      <span className="num rounded-none bg-surface-sel px-1.5 py-0.5 font-mono text-[11px] text-ink-5">
        {pending ? 'Đang chấm…' : '—'}
      </span>
    )
  }
  const key = verdict.toLowerCase()
  const color = `var(--verdict-${key})`
  const style =
    tone === 'solid'
      ? { background: color, color: 'var(--on-accent)', borderColor: color }
      : { background: `var(--verdict-${key}-soft)`, color, borderColor: color }
  return (
    <span
      className="num rounded-none border px-1.5 py-0.5 font-mono text-[11px] font-semibold"
      style={style}
      // Mã gốc lùi về tooltip: người quen thuật ngữ vẫn tra được, còn người mới
      // không phải đoán "TLE" nghĩa là gì ngay lúc đang lo bài mình sai chỗ nào.
      title={verdict}
    >
      {VERDICT_LABEL[verdict]}
    </span>
  )
}

export function Spinner({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-ink-5" role="status">
      <span className="size-3 animate-spin rounded-full border-2 border-line border-t-moss" />
      {label}
    </span>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-[13px] text-ink-5">
      <p className="font-display text-[16px] text-ink-2">{title}</p>
      {hint ? <p className="mt-1.5">{hint}</p> : null}
    </div>
  )
}

/**
 * Motif nhận diện: nhãn mono → đường kẻ chạy hết chiều ngang → khối 18×6px ở cuối.
 * Lấy từ dấu góc vuông + gạch chân trong logo Ban Công Nghệ.
 *
 * Đây thay cho `<h2>` ở mọi đầu mục, nên nó PHẢI là thẻ tiêu đề thật. Bản trước
 * dùng `<div>`: nhìn thì giống hệt, nhưng trình đọc màn hình mất sạch cây tiêu đề
 * và người dùng không nhảy giữa các mục được (NFR-6). Đường kẻ và khối cuối là
 * trang trí nên `aria-hidden`; chỉ nhãn nằm trong tên của tiêu đề.
 *
 * `level` cho chỗ nào lồng sâu hơn khai đúng bậc, tránh nhảy cóc h1 → h3.
 */
export function SectionRule({
  label,
  meta,
  level = 2,
}: {
  label: string
  meta?: ReactNode
  level?: 2 | 3 | 4
}) {
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4'
  return (
    <div className="flex items-end gap-0">
      <Heading className="pr-3 font-mono text-[11px] font-normal tracking-[0.14em] text-ink-6 uppercase">
        {label}
      </Heading>
      <div aria-hidden className="h-px flex-1 bg-line" />
      {meta ? (
        <div className="num pl-3 font-mono text-[11px] text-ink-5">{meta}</div>
      ) : (
        <div aria-hidden className="h-1.5 w-[18px] bg-line-strong" />
      )}
    </div>
  )
}
