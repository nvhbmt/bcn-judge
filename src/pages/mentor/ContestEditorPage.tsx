/**
 * FR-I2: sửa cấu hình contest, chọn bài, xuất bản.
 * Route: /mentor/contest/:contestId
 */
import { useState } from 'react'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, Spinner } from '@/components/ui'
import { useAuth } from '@/stores/auth'
import { ContestForm } from './ContestForm'
import { ContestProblemPicker } from './ContestProblemPicker'
import { ContestPublishPanel } from './ContestPublishPanel'
import { PHASE_CLASS, PHASE_LABEL, contestPhase } from './contestPhase'
import { Notice } from './fields'
import { isoToLocalInput } from './mentorTime'
import { readApiMessage } from './publishGate'
import { useContestMutations, useContestRow, useMentorCourses } from './useContests'
import { useMentorProblems } from './useCourseContent'

export function ContestEditorPage() {
  const { contestId = '' } = useParams()
  const me = useAuth((s) => s.me)
  const { row, isLoading, isError } = useContestRow(contestId)
  const { data: courses } = useMentorCourses()
  const { data: problems } = useMentorProblems()
  const { update, setProblems } = useContestMutations()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }
  if (isError || !row) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link to="/mentor/contest" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-5 hover:underline">
          <ArrowLeft size={15} /> Danh sách contest
        </Link>
        <EmptyState
          title="Không tìm thấy contest"
          hint="Contest có thể đã bị xoá, hoặc bạn không phụ trách khoá của nó."
        />
      </div>
    )
  }

  const phase = contestPhase(row.startAt, row.endAt)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/mentor/contest" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-5 hover:underline">
        <ArrowLeft size={15} /> Danh sách contest
      </Link>

      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[26px] text-ink-1">{row.title}</h1>
        <span className={`rounded-full px-2 py-0.5 text-xs ${PHASE_CLASS[phase]}`}>{PHASE_LABEL[phase]}</span>
        <Link
          to={`/mentor/contest/${contestId}/thong-ke`}
          className="ml-auto inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
        >
          <BarChart3 size={15} /> Thống kê
        </Link>
      </header>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {saved ? <Notice tone="ok">{saved}</Notice> : null}

      <div className="mb-5">
        <ContestForm
          mode="edit"
          initial={{
            title: row.title,
            descriptionMd: '',
            courseId: row.courseId,
            startAt: isoToLocalInput(row.startAt),
            endAt: isoToLocalInput(row.endAt),
            freezeMinutes: String(row.freezeMinutes),
            sequential: false,
          }}
          courses={courses ?? []}
          canPickClub={me?.role === 'admin'}
          pending={update.isPending}
          onSubmit={(body) => {
            setError(null)
            setSaved(null)
            update.mutate(
              { id: contestId, body },
              {
                onSuccess: () => setSaved('Đã lưu cấu hình contest.'),
                onError: (err) => setError(readApiMessage(err, 'Không lưu được contest.')),
              },
            )
          }}
        />
      </div>

      <div className="mb-5">
        <ContestProblemPicker
          bank={problems ?? []}
          existingCount={row.problemCount}
          pending={setProblems.isPending}
          onSave={(list) => {
            setError(null)
            setSaved(null)
            setProblems.mutate(
              { id: contestId, problems: list },
              {
                onSuccess: (res) => setSaved(`Đã lưu ${res.count} bài vào contest.`),
                onError: (err) => setError(readApiMessage(err, 'Không lưu được danh sách bài.')),
              },
            )
          }}
        />
      </div>

      <ContestPublishPanel contestId={contestId} status={row.status} />
    </div>
  )
}
