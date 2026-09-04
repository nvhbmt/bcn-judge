/** FR-B2: gán và gỡ mentor phụ trách khoá. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserMinus } from 'lucide-react'
import { useState } from 'react'
import { Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { describeFailure, type FailureNotice } from './conflicts'
import type { CourseMentor } from './types'
import { Card, FailureBanner } from './ui'
import { UserPicker } from './UserPicker'

export function CourseMentors({ courseId }: { courseId: string }) {
  const client = useQueryClient()
  const [notice, setNotice] = useState<FailureNotice | null>(null)
  const key = ['admin', 'course', courseId, 'mentors']

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get<CourseMentor[]>(`/api/admin/courses/${courseId}/mentors`),
  })

  const refresh = () => {
    void client.invalidateQueries({ queryKey: key })
    void client.invalidateQueries({ queryKey: ['admin', 'courses'] })
  }

  const add = useMutation({
    mutationFn: (userId: string) => api.post(`/api/admin/courses/${courseId}/mentors`, { userId }),
    onSuccess: () => {
      setNotice(null)
      refresh()
    },
    onError: (err) => setNotice(describeFailure(err, 'Không gán được mentor.')),
  })

  const remove = useMutation({
    mutationFn: (userId: string) => api.del(`/api/admin/courses/${courseId}/mentors/${userId}`),
    onSuccess: () => {
      setNotice(null)
      refresh()
    },
    onError: (err) => setNotice(describeFailure(err, 'Không gỡ được mentor.')),
  })

  return (
    <Card title="Mentor phụ trách">
      <FailureBanner notice={notice} />

      {isLoading ? <Spinner /> : null}

      {data && data.length === 0 ? (
        <p className="mb-3 text-sm text-ink-5">
          Chưa có mentor nào. Mentor được gán sẽ thấy khoá trong mục “Khoá tôi phụ trách” và soạn được nội dung.
        </p>
      ) : null}

      {data && data.length > 0 ? (
        <ul className="mb-3 divide-y divide-line">
          {data.map((mentor) => (
            <li key={mentor.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{mentor.displayName}</span>
                <span className="block truncate font-mono text-xs text-ink-5">{mentor.email}</span>
              </span>
              <button
                type="button"
                onClick={() => remove.mutate(mentor.id)}
                disabled={remove.isPending}
                className="ml-auto inline-flex shrink-0 items-center gap-1 border border-line-strong px-2 py-1
 text-xs hover:bg-surface-sel disabled:cursor-not-allowed disabled:border-line disabled:text-ink-5 disabled:opacity-100 focus-visible:outline-2
 focus-visible:outline-offset-1 focus-visible:outline-primary"
              >
                <UserMinus size={13} /> Gỡ
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mb-1.5 text-xs text-ink-5">
        Chỉ tài khoản vai trò Mentor hoặc Admin gán được — chọn nhầm tài khoản Member sẽ bị từ chối.
      </p>
      <UserPicker
        actionLabel="Gán mentor"
        onPick={(user) => add.mutate(user.id)}
        disabledIds={(data ?? []).map((m) => m.id)}
        pending={add.isPending}
      />
    </Card>
  )
}
