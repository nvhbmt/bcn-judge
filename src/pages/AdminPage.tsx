import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, SectionRule, Spinner } from '@/components/ui'
import { api } from '@/lib/api'

interface JudgeStatus {
  queue: { pendingSubmit: number; pendingRun: number; running: number; oldestPendingSubmitSec: number | null }
  workers: { id: string; slots: number; alive: boolean; lastSeenAt: string }[]
  ieSubmissions: { id: string; ieReason: string | null; receivedAt: string }[]
  judgePaused: boolean
  health: { submitBacklogAlarm: boolean; runBacklogWarning: boolean; noLiveWorker: boolean }
}

/** FR-H3: trang tình trạng chấm cho admin. */
export function AdminPage() {
  const client = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'judge'],
    queryFn: () => api.get<JudgeStatus>('/api/admin/judge'),
    refetchInterval: 5000,
  })
  const retryIe = useMutation({
    mutationFn: () => api.post('/api/admin/judge/retry-ie', { withinHours: 24 }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'judge'] }),
  })
  const togglePause = useMutation({
    mutationFn: (paused: boolean) => api.post('/api/admin/judge/pause', { paused }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'judge'] }),
  })

  if (isLoading) return <div className="grid h-full place-items-center"><Spinner /></div>
  if (!data) return <EmptyState title="Không đọc được tình trạng chấm" />

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-5 hover:underline">
        <ArrowLeft size={15} /> Trang chủ
      </Link>
      <h1 className="mb-4 font-display text-[26px] text-ink-1">Tình trạng chấm bài</h1>

      {/* Hai băng tách bạch: backlog chạy thử chỉ cảnh báo, backlog nộp bài mới kéo chuông. */}
      {data.health.noLiveWorker ? <Alarm>Không có worker nào sống — bài nộp đang xếp hàng.</Alarm> : null}
      {data.health.submitBacklogAlarm ? <Alarm>Bài nộp chờ quá 2 phút — kiểm tra worker.</Alarm> : null}
      {data.health.runBacklogWarning ? (
        <p className="mb-3 bg-[var(--tint-earth)] px-3 py-2 text-sm text-earth">
          Nhiều lượt chạy thử đang chờ — bình thường ở giờ đầu contest.
        </p>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Nộp bài chờ" value={data.queue.pendingSubmit} />
        <Stat label="Chạy thử chờ" value={data.queue.pendingRun} />
        <Stat label="Đang chấm" value={data.queue.running} />
        <Stat
          label="Chờ lâu nhất"
          value={data.queue.oldestPendingSubmitSec === null ? '—' : `${Math.round(data.queue.oldestPendingSubmitSec)}s`}
        />
      </div>

      <section className="mb-5">
        <div className="mb-2"><SectionRule label="Worker" /></div>
        {data.workers.length === 0 ? (
          <p className="text-sm text-ink-5">Chưa worker nào đăng ký.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.workers.map((w) => (
              <li key={w.id} className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${w.alive ? 'bg-[var(--color-ac)]' : 'bg-[var(--color-wa)]'}`} />
                <span className="font-mono text-xs">{w.id}</span>
                <span className="text-ink-5">{w.slots} slot</span>
                <span className="ml-auto text-xs text-ink-6">
                  {new Date(w.lastSeenAt).toLocaleTimeString('vi-VN')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-5">
        <div className="mb-2"><SectionRule label="Bài lỗi hệ thống (IE) — 48 giờ qua" /></div>
        <p className="mb-2 text-sm text-ink-5">
          {data.ieSubmissions.length} bài. IE không tính vào lượt của member và được chấm lại.
        </p>
        <Button onClick={() => retryIe.mutate()} disabled={retryIe.isPending || data.ieSubmissions.length === 0}>
          {retryIe.isPending ? 'Đang xếp lại…' : 'Chấm lại toàn bộ IE trong 24 giờ'}
        </Button>
      </section>

      <section>
        <div className="mb-2"><SectionRule label="Bảo trì" /></div>
        <p className="mb-2 text-sm text-ink-5">
          Tạm dừng nhận bài nộp mới; member vẫn đọc đề và lưu nháp bình thường.
        </p>
        <Button
          variant={data.judgePaused ? 'primary' : 'danger'}
          onClick={() => togglePause.mutate(!data.judgePaused)}
          disabled={togglePause.isPending}
        >
          {data.judgePaused ? 'Mở nhận bài trở lại' : 'Tạm dừng nhận bài'}
        </Button>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-line bg-surface-2 px-3 py-2">
      <p className="text-xs text-ink-5">{label}</p>
      <p className="font-mono text-lg tabular-nums">{value}</p>
    </div>
  )
}

function Alarm({ children }: { children: string }) {
  return (
    <p role="alert" className="mb-3 bg-[var(--tint-clay)] px-3 py-2 text-sm text-[var(--color-wa)]">
      {children}
    </p>
  )
}
