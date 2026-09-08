/**
 * Công tắc "cho người khác xem bài AC của tôi" (FR-K, opt-out) ở trang Tài khoản.
 *
 * Ghi ngay khi bấm, không có nút Lưu: một checkbox có nút Lưu bên cạnh là hai bước cho
 * một quyết định nhị phân, và người ta bấm xong rồi rời trang tưởng đã xong.
 */
import { useMutation } from '@tanstack/react-query'
import { api, ApiFailure } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import type { Me } from '@/types/api'

export function ShareSolutionsToggle({ me }: { me: Me }) {
  const { bootstrap } = useAuth()
  const save = useMutation({
    mutationFn: (shareSolutions: boolean) => api.patch('/auth/me', { shareSolutions }),
    onSuccess: () => bootstrap(),
  })
  return (
    <>
      <h2 className="mb-1 font-mono text-[12px] tracking-widest text-ink-5 uppercase">Lời giải</h2>
      <p className="mb-3 text-[14px] leading-[1.6] text-ink-5">
        Người đã giải được một bài xem được bài AC tốt nhất của những người khác ở mục <em>Lời giải</em> — để học
        cách người ta làm. Mentor luôn xem được mọi bài nộp, công tắc này chỉ chi phối thành viên khác.
      </p>
      <label className="mb-8 flex cursor-pointer items-start gap-3 border border-line bg-surface-2 px-4 py-3.5">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-(--moss)"
          checked={me.shareSolutions}
          disabled={save.isPending}
          onChange={(e) => save.mutate(e.target.checked)}
        />
        <span className="text-[14px] text-ink-2">
          Cho thành viên khác xem bài AC của tôi
          {save.isPending ? <span className="ml-2 font-mono text-[12px] text-ink-5">đang lưu…</span> : null}
          {save.error ? (
            <span role="alert" className="ml-2 font-mono text-[12px] text-wa">
              {save.error instanceof ApiFailure ? save.error.error.message : 'Không lưu được.'}
            </span>
          ) : null}
        </span>
      </label>
    </>
  )
}
