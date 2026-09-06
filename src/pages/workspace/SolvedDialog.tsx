/**
 * Hộp thoại mừng AC — hiện khi một lượt NỘP (không phải chạy thử) trả về AC, hỏi
 * người học đi bài kế hay ở lại.
 *
 * Vì sao đáng có: AC là mốc kết thúc một bài, và câu hỏi tự nhiên ngay sau đó là
 * "bài tiếp theo đâu". Trước đây người học phải tự mở Giáo trình tìm — mạch làm bài
 * đứt đúng lúc đang trớn. Nút "Làm bài tiếp" đưa thẳng sang bài kề sau.
 *
 * Là hộp thoại thật (role=dialog, aria-modal), không phải một banner: nó chặn để hỏi
 * MỘT câu rồi biến mất, không nằm lại chiếm chỗ. Bấm nền, Esc, hay "Ở lại" đều là
 * cùng một lựa chọn "ở lại" — người học xem lại kết quả của chính mình.
 *
 * Không confetti, không chuyển động thừa: hệ thiết kế không có hoạt ảnh trang trí.
 */
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import type { SiblingLink } from './ContentHeader'

export function SolvedDialog({
  score,
  next,
  onStay,
  onNext,
}: {
  score: number | null
  /** Bài kề sau; null = đây là bài cuối, chỉ còn nút "Ở lại". */
  next: SiblingLink | null
  onStay: () => void
  onNext: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Tiêu điểm vào nút chính lúc mở; trả về chỗ cũ khi đóng (không rơi về đầu trang).
    // Focus qua [data-primary] thay vì ref trên <Button> — Button là function
    // component thường, không chắc chuyển tiếp ref.
    const truoc = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLElement>('[data-primary]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onStay()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      truoc?.focus?.()
    }
  }, [onStay])

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      // Bấm ĐÚNG lớp nền (không phải bên trong panel) = ở lại.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onStay()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="solved-title"
        className="w-full max-w-96 border border-line-strong bg-surface-1 p-5"
      >
        <h2 id="solved-title" className="font-display text-[22px] text-ink-1">
          Chấp nhận — bài đã xong
        </h2>
        <p className="mt-1.5 text-[14px] text-ink-4">
          {score !== null ? `Điểm: ${score}đ. ` : ''}
          {next ? 'Làm tiếp bài kế hay ở lại xem kết quả?' : 'Đây là bài cuối trong danh sách.'}
        </p>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button {...(next ? {} : { 'data-primary': true })} onClick={onStay}>
            Ở lại
          </Button>
          {next ? (
            <Link
              data-primary
              to={next.href}
              onClick={onNext}
              className="inline-flex items-center gap-2 rounded-none bg-(--moss-solid,var(--moss)) px-4 py-2 font-mono text-[13px] font-semibold tracking-[0.06em] text-on-accent uppercase transition-opacity duration-120 ease-linear hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
            >
              Làm bài tiếp <span aria-hidden>→</span>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
