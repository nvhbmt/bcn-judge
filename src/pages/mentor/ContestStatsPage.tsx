/**
 * FR-I7: thống kê contest — ai mở, ai nộp, ai chưa, phân bố verdict theo bài.
 * Route: /mentor/contest/:contestId/thong-ke
 */
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, Spinner, VerdictBadge } from '@/components/ui'
import { Notice } from './fields'
import { groupByProblem, percent } from './contestStats'
import { useContestStats } from './useContests'

export function ContestStatsPage() {
  const { contestId = '' } = useParams()
  const { data, isLoading, isError } = useContestStats(contestId)

  if (isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }

  const byProblem = groupByProblem(data?.byProblem ?? [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        to={`/mentor/contest/${contestId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:underline"
      >
        <ArrowLeft size={15} /> Về contest
      </Link>

      <h1 className="mb-4 text-xl font-semibold">Thống kê contest</h1>

      {isError || !data ? (
        <Notice tone="error">Không đọc được thống kê — kiểm tra bạn có quyền với contest này không.</Notice>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <Stat label="Đã mở contest" value={data.opened} />
            <Stat label="Đã nộp bài" value={data.submitted} />
            {/* "Mở nhưng chưa nộp" mới là danh sách cần nhắc, không phải hiệu hai
                số trên: `opened` đếm người vào, `submitted` đếm người nộp. */}
            <Stat label="Chưa nộp" value={data.notSubmitted.length} />
          </div>

          <section className="mb-5">
            <h2 className="mb-2 text-sm font-semibold">Phân bố verdict theo bài</h2>
            {byProblem.length === 0 ? (
              <EmptyState title="Contest chưa có bài nào" />
            ) : (
              <ul className="grid gap-2">
                {byProblem.map((p) => (
                  <li
                    key={p.contestProblemId}
                    className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</h3>
                      <span className="text-xs text-slate-500">
                        {p.total} lượt nộp · AC {p.acCount} ({percent(p.acCount, p.total)})
                      </span>
                    </div>
                    {p.total === 0 ? (
                      <p className="mt-1 text-sm text-slate-500">Chưa ai nộp bài này.</p>
                    ) : (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {p.counts.map((c) => (
                          <li key={c.verdict} className="inline-flex items-center gap-1">
                            <VerdictBadge verdict={c.verdict} />
                            <span className="font-mono text-xs tabular-nums text-slate-500">×{c.n}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Đã mở contest nhưng chưa nộp bài nào</h2>
            {data.notSubmitted.length === 0 ? (
              <p className="text-sm text-slate-500">Mọi người đã mở contest đều đã nộp ít nhất một bài.</p>
            ) : (
              <ul className="grid gap-1 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
                {data.notSubmitted.map((u) => (
                  <li key={u.id}>{u.displayName}</li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-mono text-lg tabular-nums">{value}</p>
    </div>
  )
}
