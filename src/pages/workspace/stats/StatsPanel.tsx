/**
 * Mục "Thống kê" của thanh icon (FR-E3 v0.8) — bài đang mở, dưới góc nhìn của mọi vai.
 *
 * Bốn khối, theo thứ tự câu hỏi người ta thật sự hỏi: bài này khó không (bao nhiêu
 * người giải được) → người ta sai ở đâu (verdict) → viết bằng gì → mình đứng đâu
 * (thời gian của bài AC tốt nhất mỗi người, và dòng "bạn" nổi moss như mọi chỗ đánh
 * dấu mình). Không tên ai: server đã không trả, đây chỉ là chỗ nói rõ điều đó.
 *
 * Không có invalidation từ luồng verdict: panel này unmount khi rời mục nên mở lại là
 * nạp mới; ở lại thì 15 s làm mới một lần — cùng nhịp với BXH khoá (NFR-4 v0.6).
 */
import { useQuery } from '@tanstack/react-query'
import { EmptyState, SectionRule, Spinner } from '@/components/ui'
import { StatStrip } from '@/components/ui/patterns'
import { api } from '@/lib/api'
import type { ProblemStats } from '@/types/api'
import { formatDuration, formatMemory } from '../format'
import { TimeHistogram } from './TimeHistogram'
import { VerdictBars } from './VerdictBars'

export function StatsPanel({ handleQuery }: { handleQuery: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['stats', handleQuery],
    queryFn: () => api.get<ProblemStats>(`/api/member/stats/problem?${handleQuery}`),
    refetchInterval: 15_000,
  })

  if (isLoading) {
    return (
      <div className="p-4">
        <Spinner />
      </div>
    )
  }
  if (!data) return <EmptyState title="Không đọc được thống kê của bài này" />
  if (data.submissions === 0) {
    return <EmptyState title="Chưa ai nộp bài này" hint="Nộp bài đầu tiên và quay lại đây." />
  }

  const solvedPct = data.users > 0 ? Math.round((100 * data.solvedUsers) / data.users) : 0
  const langTotal = data.languages.reduce((s, l) => s + l.count, 0)

  return (
    <div className="flex flex-col gap-7 px-4 py-4">
      <StatStrip
        items={[
          { label: 'Lượt nộp', value: data.submissions },
          { label: 'Người đã nộp', value: data.users },
          { label: 'Đã giải', value: `${data.solvedUsers}/${data.users}` },
          // Tỉ lệ giải tô theo nghĩa cố định của màu điểm: cao là moss (đang tốt),
          // thấp là earth (đáng chú ý) — không phải một thang màu riêng.
          { label: 'Tỉ lệ giải', value: `${solvedPct}%`, tone: solvedPct >= 50 ? 'moss' : 'earth' },
        ]}
      />

      {data.mine ? (
        <p className="border-l-2 border-moss bg-primary-soft px-3 py-2 text-[14px] text-ink-2">
          <span className="font-semibold text-ink-1">Bạn:</span>{' '}
          <span className="num font-mono">{formatDuration(data.mine.bestTimeMs)}</span> ·{' '}
          <span className="num font-mono">{formatMemory(data.mine.bestMemoryKb)}</span>
          {data.mine.fasterThanPct !== null ? (
            <>
              {' '}
              · nhanh hơn <span className="num font-mono font-semibold text-moss">{data.mine.fasterThanPct}%</span> người đã AC
            </>
          ) : (
            <span className="text-ink-5"> · chưa có ai khác AC để so</span>
          )}
        </p>
      ) : null}

      <section>
        <SectionRule label="Verdict" meta={`${data.submissions} lượt`} level={3} />
        <div className="mt-3">
          <VerdictBars verdicts={data.verdicts} total={data.submissions} />
        </div>
      </section>

      <section>
        <SectionRule label="Ngôn ngữ" level={3} />
        <ul className="mt-3 flex flex-col gap-1.5">
          {data.languages.map((l) => (
            <li key={l.id} className="flex items-center gap-3 text-[13px]">
              <span className="w-16 shrink-0 font-mono text-ink-3">{l.id}</span>
              <span className="h-2 flex-1 bg-surface-2">
                <span
                  className="block h-full bg-ink-4"
                  style={{ width: `${langTotal > 0 ? (100 * l.count) / langTotal : 0}%` }}
                />
              </span>
              <span className="num w-10 shrink-0 text-right font-mono text-ink-5">{l.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionRule
          label="Thời gian chạy"
          meta={data.time.p50 !== null ? `p50 ${data.time.p50} ms · p90 ${data.time.p90} ms` : 'chưa ai AC'}
          level={3}
        />
        <p className="mt-1 text-[12px] text-ink-5">Bài AC tốt nhất của mỗi người, so với giới hạn {data.time.limitMs} ms.</p>
        <div className="mt-3">
          <TimeHistogram buckets={data.time.buckets} mineMs={data.mine?.bestTimeMs ?? null} />
        </div>
      </section>
    </div>
  )
}
