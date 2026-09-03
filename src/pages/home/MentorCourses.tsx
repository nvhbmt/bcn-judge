/**
 * Khoá mà mentor/admin phụ trách — hiện ngay trên trang chủ.
 *
 * Vì sao cần: trang chủ chỉ gọi `/api/member/courses`, tức khoá mình được GHI DANH.
 * Mentor không ghi danh vào khoá mình dạy (họ nằm ở `course_mentors`), nên màn hình
 * của họ là "Bạn đang theo 0 khoá · Chưa có khoá học nào · Liên hệ mentor để được ghi
 * danh" — một mentor được bảo đi liên hệ mentor. Và không có lối vào nào tới khoá của
 * chính họ: `~/bài-tập` và `~/soạn-contest` có trên thanh trên, khoá học thì không.
 *
 * Link đi thẳng vào màn SỬA khoá, không phải màn xem như member: mentor mở khoá ra là
 * để soạn giáo trình và ghi danh, còn muốn xem như học viên thì trong đó đã có link.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { SectionRule, Spinner } from '@/components/ui'
import { Row, RowGroup } from '@/components/ui/patterns'
import { api } from '@/lib/api'

interface MentorCourse {
  id: string
  code: string
  name: string
  status: string
  memberCount: number
}

/**
 * Admin thấy MỌI khoá (server không lọc theo `course_mentors` với admin), nên chữ
 * phải nói đúng chuyện đó — "bạn phụ trách" mà liệt kê cả khoá của người khác là sai.
 * Một hàm cho cả nhãn mục lẫn câu chào ở trang chủ, để hai chỗ không lệch nhau.
 */
export function vaiTroKhoa(role: string): string {
  return role === 'admin' ? 'quản lý' : 'phụ trách'
}

export function MentorCourses({ role }: { role: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['mentor', 'courses'],
    queryFn: () => api.get<MentorCourse[]>('/api/mentor/courses'),
    enabled: role !== 'member',
  })

  if (role === 'member') return null
  if (isLoading) return <Spinner />
  if (!data || data.length === 0) return null

  return (
    <section className="mb-8">
      <SectionRule label={`Khoá bạn ${vaiTroKhoa(role)}`} meta={`${data.length} khoá`} />
      <RowGroup className="mt-4">
        {data.map((c) => (
          <Row key={c.id} interactive>
            <Link
              to={`/mentor/khoa-hoc/${c.id}/thong-tin`}
              className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 no-underline"
            >
              <span className="min-w-0 flex-1 truncate text-[14px] text-ink-2">{c.name}</span>
              <span className="num font-mono text-[11px] text-ink-6">{c.code}</span>
              <span className="num w-24 text-right font-mono text-[12px] text-ink-5">
                {c.memberCount} học viên
              </span>
              {c.status !== 'open' ? (
                <span className="font-mono text-[10px] tracking-[0.06em] text-earth uppercase">{c.status}</span>
              ) : null}
            </Link>
          </Row>
        ))}
      </RowGroup>
    </section>
  )
}
