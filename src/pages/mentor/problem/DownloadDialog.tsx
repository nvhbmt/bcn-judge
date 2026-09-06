/**
 * Hộp thoại "Tải bài làm về máy" cho màn xem bài nộp của mentor.
 *
 * Hai lựa chọn: TẤT CẢ lượt nộp, hoặc CHỈ bài AC cuối của mỗi người (ai chưa AC thì
 * lấy lượt cuối để còn thấy lỗi). Server nén sẵn .zip và đặt tên file theo tên không
 * dấu ("viet_hoang_bai_nop.c"); ở đây chỉ tải blob rồi kích cho trình duyệt lưu.
 */
import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'

async function taiZip(problemId: string, mode: 'best' | 'all'): Promise<void> {
  const res = await fetch(`/api/mentor/problems/${problemId}/submissions/download?mode=${mode}`, {
    credentials: 'same-origin',
  })
  if (!res.ok) {
    let msg = 'Không tải được. Thử lại sau.'
    try {
      const j = (await res.json()) as { error?: { message?: string } }
      if (j?.error?.message) msg = j.error.message
    } catch {
      // body không phải JSON — giữ thông báo mặc định.
    }
    throw new Error(msg)
  }
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') ?? ''
  const name = /filename="?([^"]+)"?/.exec(cd)?.[1] ?? `bai-nop-${mode}.zip`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function DownloadDialog({ problemId, onClose }: { problemId: string; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [err, setErr] = useState<string | null>(null)

  const tai = useMutation({
    mutationFn: (mode: 'best' | 'all') => taiZip(problemId, mode),
    onSuccess: () => onClose(),
    onError: (e: unknown) => setErr(e instanceof Error ? e.message : 'Không tải được.'),
  })

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('[data-primary]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !tai.isPending) {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, tai.isPending])

  const busy = tai.isPending

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dl-title"
        className="w-full max-w-md border border-line-strong bg-surface-1 p-5"
      >
        <h2 id="dl-title" className="font-display text-[22px] text-ink-1">
          Tải bài làm về máy
        </h2>
        <p className="mt-1 text-[14px] text-ink-4">Đóng gói mã nguồn thành một file .zip.</p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            data-primary
            disabled={busy}
            onClick={() => {
              setErr(null)
              tai.mutate('best')
            }}
            className="border border-line-strong bg-surface-2 px-4 py-3 text-left hover:border-moss disabled:opacity-60"
          >
            <div className="text-[15px] font-semibold text-ink-1">AC cuối của mỗi người</div>
            <div className="mt-0.5 text-[13px] text-ink-4">
              Mỗi người một file — bài AC mới nhất; ai chưa AC thì lấy lượt nộp cuối.
            </div>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setErr(null)
              tai.mutate('all')
            }}
            className="border border-line-strong bg-surface-2 px-4 py-3 text-left hover:border-moss disabled:opacity-60"
          >
            <div className="text-[15px] font-semibold text-ink-1">Tất cả lượt nộp</div>
            <div className="mt-0.5 text-[13px] text-ink-4">Mọi lượt nộp của mọi người (trùng tên sẽ thêm _2, _3…).</div>
          </button>
        </div>

        {err ? (
          <p role="alert" className="mt-3 text-[13px] text-clay">
            {err}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          {busy ? <span className="mr-auto font-mono text-[12px] text-ink-5">Đang nén…</span> : null}
          <Button onClick={onClose} disabled={busy}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  )
}
