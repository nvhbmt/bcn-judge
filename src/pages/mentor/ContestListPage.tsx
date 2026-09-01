/**
 * FR-I1/I2/I9: danh sách contest của mentor + tạo mới + nhân bản.
 * Route: /mentor/contest
 */
import { useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, EmptyState, Spinner } from '@/components/ui'
import { useAuth } from '@/stores/auth'
import { ContestCard } from './ContestCard'
import { ContestForm } from './ContestForm'
import { EMPTY_CONTEST } from './contestFormValues'
import { Notice } from './fields'
import { readApiMessage } from './publishGate'
import { useContestMutations, useContests, useMentorCourses } from './useContests'

export function ContestListPage() {
  const me = useAuth((s) => s.me)
  const navigate = useNavigate()
  const { data, isLoading, isError } = useContests()
  const { data: courses } = useMentorCourses()
  const { create, clone } = useContestMutations()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = me?.role === 'admin'
  const contests = data ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:underline">
        <ArrowLeft size={15} /> Trang chủ
      </Link>

      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Contest</h1>
          <p className="text-sm text-slate-500">
            Trạng thái <i>Sắp diễn ra / Đang diễn ra / Đã kết thúc</i> suy ra từ khung thời gian (FR-I1).
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating((v) => !v)} aria-expanded={creating}>
          <Plus size={15} /> Tạo contest
        </Button>
      </header>

      {isError ? <Notice tone="error">Không đọc được danh sách contest.</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {/* Chờ danh sách khoá rồi mới dựng form: ContestForm giữ giá trị ban đầu trong
          useState nên khoá mặc định phải có SẴN lúc mount, sau đó cập nhật không kịp. */}
      {creating && !courses ? <Spinner label="Đang tải danh sách khoá…" /> : null}
      {creating && courses ? (
        <div className="mb-5">
          <ContestForm
            mode="create"
            // Mentor không được để trống phạm vi; mở sẵn khoá đầu tiên cho đỡ một cú bấm.
            initial={{ ...EMPTY_CONTEST, courseId: isAdmin ? null : (courses[0]?.id ?? null) }}
            courses={courses}
            canPickClub={isAdmin}
            pending={create.isPending}
            onSubmit={(body) => {
              setError(null)
              create.mutate(body, {
                // Contest mới luôn rỗng bài → đưa thẳng sang trang chọn bài.
                onSuccess: (row) => navigate(`/mentor/contest/${row.id}`),
                onError: (err) => setError(readApiMessage(err, 'Không tạo được contest.')),
              })
            }}
          />
        </div>
      ) : null}

      {isLoading ? <Spinner /> : null}

      {!isLoading && contests.length === 0 && !isError ? (
        <EmptyState title="Chưa có contest nào" hint="Tạo contest đầu tiên bằng nút phía trên." />
      ) : null}

      <ul className="grid gap-3">
        {contests.map((row) => (
          <ContestCard
            key={row.id}
            row={row}
            cloning={clone.isPending && clone.variables === row.id}
            onClone={() => {
              setError(null)
              clone.mutate(row.id, {
                onSuccess: (created) => navigate(`/mentor/contest/${created.id}`),
                onError: (err) => setError(readApiMessage(err, 'Không nhân bản được contest.')),
              })
            }}
          />
        ))}
      </ul>
    </div>
  )
}
