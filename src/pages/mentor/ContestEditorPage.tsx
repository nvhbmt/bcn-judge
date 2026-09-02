/**
 * FR-I2: sửa cấu hình contest, chọn bài, xuất bản.
 * Route: /mentor/contest/:contestId
 *
 * Hai khung như trình soạn bài: TRÁI là thông tin contest + xuất bản, PHẢI là bài
 * trong contest. Dùng chung `SplitPane` (nhớ tỉ lệ kéo) để hai màn soạn của mentor
 * hành xử giống nhau — mentor kéo quen tay ở màn này thì màn kia cũng vậy.
 */
import { useState } from 'react'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PageContainer } from '@/components/layout/PageContainer'
import { SplitPane } from '@/components/layout/SplitPane'
import { EmptyState, Spinner } from '@/components/ui'
import { useAuth } from '@/stores/auth'
import { ContestForm } from './ContestForm'
import { ContestProblemPanel } from './ContestProblemPanel'
import { ContestPublishPanel } from './ContestPublishPanel'
import { PHASE_CLASS, PHASE_LABEL, contestPhase } from './contestPhase'
import { Notice } from './fields'
import { isoToLocalInput } from './mentorTime'
import { readApiMessage } from './publishGate'
import { useContestDetail, useContestMutations, useContestRow, useMentorCourses } from './useContests'
import { useMentorProblems } from './useCourseContent'

export function ContestEditorPage() {
  const { contestId = '' } = useParams()
  const me = useAuth((s) => s.me)
  const { row, isLoading, isError } = useContestRow(contestId)
  const { data: detail } = useContestDetail(contestId)
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
      <PageContainer>
        <Link to="/mentor/contest" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-5 hover:underline">
          <ArrowLeft size={15} /> Danh sách contest
        </Link>
        <EmptyState
          title="Không tìm thấy contest"
          hint="Contest có thể đã bị xoá, hoặc bạn không phụ trách khoá của nó."
        />
      </PageContainer>
    )
  }

  const phase = contestPhase(row.startAt, row.endAt)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-2">
        <Link to="/mentor/contest" className="inline-flex items-center gap-1 text-sm text-ink-5 hover:underline">
          <ArrowLeft size={15} /> Danh sách contest
        </Link>
        <h1 className="truncate font-display text-[16px] text-ink-1">{row.title}</h1>
        <span className={`px-2 py-0.5 text-xs ${PHASE_CLASS[phase]}`}>{PHASE_LABEL[phase]}</span>
        <Link
          to={`/mentor/contest/${contestId}/thong-ke`}
          className="ml-auto inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
        >
          <BarChart3 size={15} /> Thống kê
        </Link>
        {error || saved ? (
          <div className="w-full">
            {error ? <Notice tone="error">{error}</Notice> : null}
            {saved ? <Notice tone="ok">{saved}</Notice> : null}
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1">
        <SplitPane
          storageKey="bcn:mentor-contest"
          defaultRatio={0.5}
          minPx={360}
          left={
            <div className="h-full min-h-0 overflow-auto px-4 py-3">
              {/* Chờ `detail` rồi mới dựng form, cùng lý do với khung phải:
                  ContestForm cũng `useState(initial)` một lần. Dựng sớm thì ô mô tả
                  hiện rỗng dù contest có mô tả, và lưu là ghi đè mất nó. */}
              {detail === undefined ? (
                <Spinner />
              ) : (
              <ContestForm
                key={contestId}
                mode="edit"
                initial={{
                  title: row.title,
                  descriptionMd: detail.descriptionMd ?? '',
                  courseId: row.courseId,
                  startAt: isoToLocalInput(row.startAt),
                  endAt: isoToLocalInput(row.endAt),
                  freezeMinutes: String(row.freezeMinutes),
                  sequential: detail.sequential,
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
              )}
              <div className="mt-5">
                <ContestPublishPanel contestId={contestId} status={row.status} />
              </div>
            </div>
          }
          right={
            // Chờ có `detail` rồi mới dựng panel, và `key` theo số bài đọc được:
            // state của panel chỉ lấy `initial` một lần, dựng sớm là form rỗng.
            detail === undefined ? (
              <div className="grid h-full place-items-center">
                <Spinner />
              </div>
            ) : (
              <ContestProblemPanel
                key={`${contestId}:${detail.problems.length}`}
                bank={problems ?? []}
                initial={detail.problems.map((p) => ({
                  problemId: p.problemId,
                  title: p.title,
                  label: p.label ?? '',
                  maxScore: String(p.maxScore),
                }))}
                lockedIds={detail.problems.filter((p) => p.hasSubmissions).map((p) => p.problemId)}
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
            )
          }
        />
      </div>
    </div>
  )
}
