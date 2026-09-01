/**
 * Bài ĐỌC của giáo trình — phần lý thuyết xen giữa các bài tập.
 *
 * Trước đây mục loại `lesson` không có đường hiển thị nào: cả hai danh sách giáo trình
 * đều trỏ nó vào `/khoa-hoc/:id/bai/:itemId`, mà màn đó hỏi `/api/member/problems` và
 * nhận 404 — nên bấm vào một bài đọc chỉ ra khung trống. Mentor vẫn soạn được nội dung
 * (`lessonBodyMd` đã có ở form của họ), chỉ là không ai đọc được.
 *
 * Dựng bằng cùng bộ Markdown với đề bài, nên code block và công thức KaTeX trong bài
 * lý thuyết hiện y như trong đề — đó là lý do nội dung này được viết bằng Markdown.
 */
import { useQuery } from '@tanstack/react-query'
import { EmptyState, Spinner } from '@/components/ui'
import { Markdown } from '@/components/markdown/Markdown'
import { api } from '@/lib/api'

export interface LessonView {
  id: string
  title: string
  bodyMd: string | null
  courseId: string
}

export function LessonPanel({ itemId }: { itemId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['lesson', itemId],
    queryFn: () => api.get<LessonView>(`/api/member/items/${itemId}/lesson`),
  })

  if (isLoading) {
    return (
      <div className="p-4">
        <Spinner />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Không mở được bài đọc này"
        hint="Bài có thể đã bị gỡ, chưa tới giờ mở, hoặc bạn chưa được ghi danh vào khoá chứa nó."
      />
    )
  }

  return (
    <article className="px-5 py-4">
      <h1 className="font-display text-[22px] text-ink-1">{data.title}</h1>
      <div className="mt-3">
        {data.bodyMd ? (
          <Markdown source={data.bodyMd} />
        ) : (
          // Mentor tạo được mục rỗng rồi soạn sau. Nói thẳng ra chứ không để trang
          // trắng, vì trang trắng trông y như lỗi tải.
          <p className="text-[14px] text-ink-5">Bài đọc này chưa có nội dung.</p>
        )}
      </div>
    </article>
  )
}
