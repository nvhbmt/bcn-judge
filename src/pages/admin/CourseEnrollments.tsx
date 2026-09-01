/** FR-B3 / US-1: ghi danh member bằng danh sách email dán vào, và gỡ ghi danh. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserMinus } from 'lucide-react'
import { useState } from 'react'
import { Button, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { describeFailure, parseEmailList, splitValidEmails, type FailureNotice } from './conflicts'
import { EnrollResult } from './EnrollResult'
import type { CourseEnrollment, EnrollReport } from './types'
import { Card, FailureBanner, TextArea } from './ui'

export function CourseEnrollments({ courseId }: { courseId: string }) {
  const client = useQueryClient()
  const [raw, setRaw] = useState('')
  const [invalid, setInvalid] = useState<string[]>([])
  const [notice, setNotice] = useState<FailureNotice | null>(null)
  const key = ['admin', 'course', courseId, 'enrollments']

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get<CourseEnrollment[]>(`/api/admin/courses/${courseId}/enrollments`),
  })

  const refresh = () => {
    void client.invalidateQueries({ queryKey: key })
    void client.invalidateQueries({ queryKey: ['admin', 'courses'] })
  }

  const enroll = useMutation({
    mutationFn: (emails: string[]) => api.post<EnrollReport>(`/api/admin/courses/${courseId}/enrollments`, { emails }),
    onSuccess: () => {
      setNotice(null)
      setRaw('')
      refresh()
    },
    onError: (err) => setNotice(describeFailure(err, 'Không ghi danh được.')),
  })

  const unenroll = useMutation({
    mutationFn: (userId: string) => api.del(`/api/admin/courses/${courseId}/enrollments/${userId}`),
    onSuccess: () => {
      setNotice(null)
      refresh()
    },
    onError: (err) => setNotice(describeFailure(err, 'Không gỡ được ghi danh.')),
  })

  const parsed = parseEmailList(raw)
  const { valid, invalid: badNow } = splitValidEmails(parsed)

  function submit() {
    /*
     * Lọc email sai định dạng NGAY TẠI CLIENT. Server dùng
     * `z.array(z.string().email())`: chỉ một dòng gõ sai là cả lô 400 và KHÔNG
     * ai được ghi danh. Dán 40 dòng từ Excel mà mất trắng vì một dấu cách thừa
     * đúng là cảnh US-1 muốn tránh — nên phần hợp lệ vẫn đi, phần sai báo lại.
     */
    setInvalid(badNow)
    if (valid.length > 0) enroll.mutate(valid)
  }

  const active = (data ?? []).filter((e) => e.status === 'active')
  const removed = (data ?? []).filter((e) => e.status !== 'active')

  return (
    <Card title={`Ghi danh member (${active.length} đang học)`}>
      <FailureBanner notice={notice} />

      <label className="mb-1 block text-xs font-medium text-ink-3" htmlFor="enroll-emails">
        Dán danh sách email
      </label>
      <TextArea
        id="enroll-emails"
        rows={5}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={'an.nguyen@bcn.local\nbinh.tran@bcn.local, chi.le@bcn.local'}
        spellCheck={false}
      />
      <p className="mt-1 text-xs text-ink-5">
        Ngăn cách bằng xuống dòng, dấu phẩy, chấm phẩy hoặc khoảng trắng — dán thẳng từ Excel hay Zalo đều được. Trùng
        lặp tự loại. {parsed.length > 0 ? `Đang nhận diện ${valid.length} email hợp lệ` : null}
        {badNow.length > 0 ? `, ${badNow.length} dòng sai định dạng` : null}
        {parsed.length > 0 ? '.' : null}
      </p>

      <div className="mt-2">
        <Button variant="primary" onClick={submit} disabled={enroll.isPending || valid.length === 0}>
          {enroll.isPending ? 'Đang ghi danh…' : `Ghi danh ${valid.length} email`}
        </Button>
      </div>

      {enroll.data ? <EnrollResult report={enroll.data} invalid={invalid} /> : null}

      <h3 className="mt-5 mb-2 text-xs font-semibold text-ink-3">Đã ghi danh</h3>
      {isLoading ? <Spinner /> : null}
      {data && data.length === 0 ? <p className="text-sm text-ink-5">Chưa member nào trong khoá.</p> : null}

      <ul className="divide-y divide-line">
        {active.map((row) => (
          <li key={row.id} className="flex items-center gap-2 py-1.5 text-sm">
            <span className="min-w-0">
              <span className="block truncate">{row.displayName}</span>
              <span className="block truncate font-mono text-xs text-ink-5">{row.email}</span>
            </span>
            <button
              type="button"
              onClick={() => unenroll.mutate(row.id)}
              disabled={unenroll.isPending}
              className="ml-auto inline-flex shrink-0 items-center gap-1 border border-line-strong px-2 py-1
 text-xs hover:bg-surface-sel disabled:cursor-not-allowed disabled:border-line disabled:text-ink-5 disabled:opacity-100 focus-visible:outline-2
 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)]"
            >
              <UserMinus size={13} /> Gỡ
            </button>
          </li>
        ))}
      </ul>

      {removed.length > 0 ? (
        <p className="mt-2 text-xs text-ink-5">
          {removed.length} member đã gỡ ghi danh. Bài nộp và tiến độ của họ vẫn còn — ghi danh lại là khôi phục.
        </p>
      ) : null}
    </Card>
  )
}
