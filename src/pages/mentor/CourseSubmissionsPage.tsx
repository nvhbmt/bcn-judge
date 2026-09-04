/**
 * Mentor đọc bài nộp của học viên trong khoá (FR-G3).
 *
 * Endpoint `GET /api/mentor/courses/:id/submissions` đã nằm sẵn ở server từ lâu, đủ cả
 * bộ lọc theo người / mục / verdict và trả kèm mã nguồn — SPA chưa từng gọi nó, nên cả
 * tính năng nằm đó không ai dùng được. Đây là lần thứ mấy trong repo này rồi.
 *
 * KHÔNG làm thành một tab của màn sửa khoá: luật ghi ở courseTabs.ts là "thấy tab
 * nghĩa là sửa được trong đó, tab chỉ-đọc ẩn hẳn". Đây là màn chỉ đọc, nên nó là
 * trang riêng.
 *
 * Hai panel, cùng hình với màn leader xem đồng đội: trái chọn học viên rồi chọn lượt
 * nộp, phải là mã nguồn. Mentor rà lớp bằng cách nhảy người này sang người kia, nên
 * danh sách phải đứng yên trong khi mã đổi.
 */
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SplitPane } from '@/components/layout/SplitPane'
import { SubmissionDetail } from '@/components/submission/SubmissionDetail'
import { EmptyState, Spinner, VerdictBadge } from '@/components/ui'
import { Avatar } from '@/components/ui/patterns'
import { api } from '@/lib/api'
import type { LanguageOption, Verdict } from '@/types/api'

interface HocVien {
  id: string
  displayName: string
  status: string
}

interface BaiNop {
  id: string
  userId: string
  displayName: string
  problemTitle: string | null
  languageId: string
  verdict: Verdict | null
  score: number | null
  receivedAt: string
  source: string | null
}

const gio = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })

export function CourseSubmissionsPage() {
  const { courseId } = useParams()
  const [nguoi, setNguoi] = useState<string | null>(null)
  const [luot, setLuot] = useState<string | null>(null)

  const { data: hocVien, isLoading } = useQuery({
    queryKey: ['mentor', 'course', courseId, 'enrollments'],
    queryFn: () => api.get<HocVien[]>(`/api/mentor/courses/${courseId}/enrollments`),
  })
  const { data: languages } = useQuery({
    queryKey: ['languages'],
    queryFn: () => api.get<LanguageOption[]>('/api/member/languages'),
    staleTime: Infinity,
  })

  const dangXem = nguoi ?? hocVien?.[0]?.id ?? null
  const { data: baiNop } = useQuery({
    queryKey: ['mentor', 'course', courseId, 'submissions', dangXem],
    queryFn: () => api.get<BaiNop[]>(`/api/mentor/courses/${courseId}/submissions?userId=${dangXem}`),
    enabled: Boolean(dangXem),
  })

  if (isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }

  // `luot` chỉ thắng khi lượt đó còn thuộc người đang xem — không thì đổi người xong
  // panel phải vẫn hiện mã của người trước.
  const hien = baiNop?.find((s) => s.id === luot) ?? baiNop?.[0] ?? null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-surface-1 px-5 py-2.5">
        <Link
          to={`/mentor/khoa-hoc/${courseId}/thong-tin`}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-5 hover:text-ink-2"
        >
          <ArrowLeft size={13} /> Sửa khoá
        </Link>
        <h1 className="font-display text-[16px] text-ink-1">Bài nộp của học viên</h1>
        <span className="font-mono text-[11px] text-ink-6">chỉ đọc</span>
      </header>

      <div className="min-h-0 flex-1">
        <SplitPane
          storageKey="bcn:mentor-submissions"
          defaultRatio={0.34}
          minPx={280}
          left={
            <div className="flex h-full min-h-0 flex-col">
              <p className="shrink-0 border-b border-line px-3.5 py-2.5 font-mono text-[11px] tracking-[0.14em] text-[var(--label)] uppercase">
                Học viên {hocVien ? `· ${hocVien.length}` : ''}
              </p>
              {!hocVien || hocVien.length === 0 ? (
                <EmptyState title="Khoá chưa có học viên nào" hint="Ghi danh member ở tab Ghi danh." />
              ) : (
                <>
                  <div className="max-h-[40%] shrink-0 overflow-y-auto">
                    <ul className="flex flex-col gap-px bg-line">
                      {hocVien.map((h) => {
                        const dang = h.id === dangXem
                        return (
                          <li key={h.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setNguoi(h.id)
                                setLuot(null)
                              }}
                              aria-current={dang ? 'true' : undefined}
                              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] transition-colors duration-[120ms] ease-linear ${
                                dang
                                  ? 'bg-[var(--color-primary-soft)] font-semibold text-ink-1 shadow-[inset_2px_0_0_var(--moss)]'
                                  : 'bg-surface-2 text-ink-3 hover:bg-surface-sel hover:text-ink-1'
                              }`}
                            >
                              <Avatar name={h.displayName} size={22} chars={1} />
                              <span className="min-w-0 truncate">{h.displayName}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>

                  <p className="shrink-0 border-y border-line px-3.5 py-2.5 font-mono text-[11px] tracking-[0.14em] text-[var(--label)] uppercase">
                    Bài nộp {baiNop ? `· ${baiNop.length}` : ''}
                  </p>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {!baiNop ? (
                      <div className="p-4">
                        <Spinner />
                      </div>
                    ) : baiNop.length === 0 ? (
                      <EmptyState title="Học viên này chưa nộp bài nào" />
                    ) : (
                      <ul className="flex flex-col gap-px bg-line">
                        {baiNop.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              onClick={() => setLuot(s.id)}
                              aria-current={s.id === hien?.id ? 'true' : undefined}
                              className={`flex w-full flex-col gap-1 px-3.5 py-2 text-left transition-colors duration-[120ms] ease-linear ${
                                s.id === hien?.id
                                  ? 'bg-surface-sel shadow-[inset_2px_0_0_var(--moss)]'
                                  : 'bg-surface-2 hover:bg-surface-sel'
                              }`}
                            >
                              <span className="truncate text-[13px] text-ink-2">
                                {s.problemTitle ?? <span className="text-ink-6">(bài đã xoá)</span>}
                              </span>
                              <span className="flex items-center gap-2">
                                <VerdictBadge tone="soft" verdict={s.verdict} />
                                <span className="num font-mono text-[11px] text-ink-5">{s.score ?? '—'}đ</span>
                                <span className="num ml-auto font-mono text-[11px] whitespace-nowrap text-ink-6">
                                  {gio(s.receivedAt)}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          }
          right={<SubmissionDetail submission={hien} languages={languages ?? []} />}
        />
      </div>
    </div>
  )
}
