import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Crown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, SectionRule, Spinner, VerdictBadge } from '@/components/ui'
import { api } from '@/lib/api'
import type { Verdict } from '@/types/api'

interface TeamView {
  id: string
  name: string
  descriptionMd: string | null
  leaderId: string
  isLeader: boolean
  members: { id: string; displayName: string; isLeader: boolean }[]
}

interface ProgressRow {
  userId: string
  displayName: string
  courseId: string
  courseName: string
  acCount: number
  totalItems: number
  lastSubmittedAt: string | null
}

interface TeamSubmission {
  id: string
  userId: string
  languageId: string
  verdict: Verdict | null
  score: number | null
  receivedAt: string
  source: string | null
  sourceEmbargoedUntil: string | null
}

/** FR-J2/J3/J4: trang team; phần tiến độ và bài nộp chỉ leader thấy. */
export function TeamPage() {
  const [openMember, setOpenMember] = useState<string | null>(null)
  const { data: team, isLoading } = useQuery({
    queryKey: ['team', 'mine'],
    queryFn: () => api.get<TeamView | null>('/api/member/teams/mine'),
  })

  if (isLoading) return <div className="grid h-full place-items-center"><Spinner /></div>
  if (!team) {
    return (
      <Shell>
        <EmptyState title="Bạn chưa thuộc team nào" hint="Quản lý viên sẽ xếp bạn vào team." />
      </Shell>
    )
  }

  return (
    <Shell>
      <header className="mb-4">
        <h1 className="font-display text-[26px] text-ink-1">{team.name}</h1>
        <p className="text-sm text-ink-5">{team.members.length} thành viên</p>
      </header>

      <ul className="mb-6 flex flex-wrap gap-2">
        {team.members.map((m) => (
          <li
            key={m.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm"
          >
            {m.isLeader ? <Crown size={14} className="text-[var(--color-tle)]" aria-label="Leader" /> : null}
            {m.displayName}
          </li>
        ))}
      </ul>

      {team.isLeader ? (
        <>
          <TeamProgress teamId={team.id} onPick={setOpenMember} />
          {openMember ? <TeamSubmissions teamId={team.id} userId={openMember} /> : null}
        </>
      ) : (
        <p className="text-sm text-ink-5">Chỉ leader xem được tiến độ và bài nộp của cả team.</p>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-5 hover:underline">
        <ArrowLeft size={15} /> Trang chủ
      </Link>
      {children}
    </div>
  )
}

function TeamProgress({ teamId, onPick }: { teamId: string; onPick: (userId: string) => void }) {
  const { data } = useQuery({
    queryKey: ['team', teamId, 'progress'],
    queryFn: () => api.get<ProgressRow[]>(`/api/member/teams/${teamId}/progress`),
  })
  if (!data) return <Spinner />
  if (data.length === 0) return <EmptyState title="Chưa thành viên nào ghi danh khoá đang mở" />

  return (
    <section className="mb-6">
      <div className="mb-2"><SectionRule label="Tiến độ theo khoá" /></div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-ink-5">
          <tr>
            <th className="py-1">Thành viên</th>
            <th>Khoá</th>
            <th className="text-right">Đã AC</th>
            <th className="text-right">Nộp gần nhất</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={`${row.userId}:${row.courseId}`} className="border-t border-line">
              <td className="py-1.5">
                <button onClick={() => onPick(row.userId)} className="text-[var(--color-primary)] hover:underline">
                  {row.displayName}
                </button>
              </td>
              <td>{row.courseName}</td>
              <td className="text-right tabular-nums">
                {row.acCount}/{row.totalItems}
              </td>
              <td className="text-right text-xs text-ink-5">
                {row.lastSubmittedAt ? new Date(row.lastSubmittedAt).toLocaleDateString('vi-VN') : 'chưa nộp'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function TeamSubmissions({ teamId, userId }: { teamId: string; userId: string }) {
  const { data } = useQuery({
    queryKey: ['team', teamId, 'submissions', userId],
    queryFn: () => api.get<TeamSubmission[]>(`/api/member/teams/${teamId}/submissions?userId=${userId}`),
  })
  if (!data) return <Spinner />

  return (
    <section>
      <div className="mb-2"><SectionRule label="Bài nộp — chỉ đọc" /></div>
      <ul className="space-y-2">
        {data.map((s) => (
          <li key={s.id} className="border border-line p-3 text-sm">
            <div className="flex items-center gap-2">
              <VerdictBadge verdict={s.verdict} />
              <span className="tabular-nums">{s.score ?? '—'} đ</span>
              <span className="font-mono text-xs text-ink-5">{s.languageId}</span>
              <span className="ml-auto text-xs text-ink-6">
                {new Date(s.receivedAt).toLocaleString('vi-VN')}
              </span>
            </div>
            {s.source ? (
              <pre className="mt-2 max-h-48 overflow-auto bg-surface-1 p-2 font-mono text-xs">
                {s.source}
              </pre>
            ) : (
              <p className="mt-2 text-xs text-ink-5">
                Contest đang diễn ra — xem được code sau{' '}
                {s.sourceEmbargoedUntil ? new Date(s.sourceEmbargoedUntil).toLocaleString('vi-VN') : 'khi kết thúc'}.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
