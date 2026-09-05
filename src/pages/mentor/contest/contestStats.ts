/** Gom `byProblem` của `GET /api/mentor/contests/:id/stats` thành từng bài (FR-I7). */
import type { Verdict } from '@/types/api'
import type { StatsRow } from './mentorTypes'

export interface ProblemVerdicts {
  contestProblemId: string
  title: string
  /** Tổng lượt NỘP đã chấm xong của bài. */
  total: number
  counts: { verdict: Verdict; n: number }[]
  acCount: number
}

/**
 * Câu SQL LEFT JOIN từ `contest_problems` sang `submissions`, nên bài CHƯA AI NỘP
 * vẫn sinh đúng một hàng với `verdict = null` — và `count(*)` của hàng rỗng đó ra
 * **1**, không phải 0. Cộng thẳng `n` vào là báo "1 lượt nộp" cho bài chưa ai đụng
 * tới; vì vậy hàng verdict null chỉ dùng để biết bài đó tồn tại.
 */
export function groupByProblem(rows: StatsRow[]): ProblemVerdicts[] {
  const out = new Map<string, ProblemVerdicts>()
  for (const row of rows) {
    let entry = out.get(row.contestProblemId)
    if (!entry) {
      entry = { contestProblemId: row.contestProblemId, title: row.title, total: 0, counts: [], acCount: 0 }
      out.set(row.contestProblemId, entry)
    }
    if (!row.verdict) continue
    entry.counts.push({ verdict: row.verdict, n: row.n })
    entry.total += row.n
    if (row.verdict === 'AC') entry.acCount += row.n
  }
  for (const entry of out.values()) {
    entry.counts.sort((a, b) => b.n - a.n || a.verdict.localeCompare(b.verdict))
  }
  return [...out.values()]
}

export function percent(part: number, whole: number): string {
  if (whole <= 0) return '0%'
  return `${Math.round((part / whole) * 100)}%`
}
