/**
 * FR-D2 — ngôn ngữ cho phép của bài, tập con của ngôn ngữ hệ thống đang bật.
 *
 * Server nhận và thi hành trường này từ đầu (dropdown ngôn ngữ của member lọc theo
 * nó), nhưng form soạn bài không có ô — nên MỌI bài đều mở cho mọi ngôn ngữ, và
 * mentor ra đề "chỉ C" không có cách nào nói điều đó với máy chấm.
 *
 * Hai trạng thái, vẽ đúng mô hình dữ liệu chứ không phỏng theo:
 *   null  = mọi ngôn ngữ đang bật (kể cả ngôn ngữ admin bật THÊM sau này)
 *   mảng  = đúng các ô đã tick
 * "Tick hết các ô" và "Mọi ngôn ngữ" vì thế KHÁC nhau, và ô master nói rõ điều đó.
 * Mảng rỗng không có đường gửi đi: bỏ tick hết là validateForm chặn bằng câu
 * tiếng người, server cũng chặn từ zod — [] nghĩa là không ai nộp được.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Field } from '@/pages/mentor/fields'
import type { ProblemFormValues } from '@/pages/mentor/form'
import type { LanguageOption } from '@/types/api'

export function LanguageAllowedField({
  values,
  onChange,
}: {
  values: ProblemFormValues
  onChange: (patch: Partial<ProblemFormValues>) => void
}) {
  const { data: languages } = useQuery({
    queryKey: ['languages'],
    queryFn: () => api.get<LanguageOption[]>('/api/member/languages'),
  })
  const all = values.allowedLanguageIds === null
  const ticked = new Set(values.allowedLanguageIds ?? [])

  return (
    <Field
      id="f-langs"
      label="Ngôn ngữ được nộp"
      hint={
        all
          ? 'Mọi ngôn ngữ đang bật — admin bật thêm ngôn ngữ mới thì bài này tự mở theo.'
          : 'Chỉ các ngôn ngữ đã tick. Khác với tick đủ mọi ô: danh sách chốt cứng, ngôn ngữ bật thêm sau này không tự vào.'
      }
    >
      <div id="f-langs" className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1" aria-describedby="f-langs-hint">
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            className="size-3.5"
            checked={all}
            onChange={(e) =>
              // Bỏ "mọi ngôn ngữ" thì khởi đầu bằng danh sách ĐANG BẬT — mentor bỏ
              // bớt từ đó, thay vì đối mặt một hàng ô trống và lời chặn "không ai
              // nộp được" ngay nhát tick đầu.
              onChange({ allowedLanguageIds: e.target.checked ? null : (languages ?? []).map((l) => l.id) })
            }
          />
          <span className="font-medium">Mọi ngôn ngữ</span>
        </label>
        {(languages ?? []).map((l) => (
          <label key={l.id} className={`flex items-center gap-1.5 text-sm ${all ? 'text-ink-5' : ''}`}>
            <input
              type="checkbox"
              className="size-3.5"
              disabled={all}
              checked={all || ticked.has(l.id)}
              onChange={(e) => {
                const next = new Set(ticked)
                if (e.target.checked) next.add(l.id)
                else next.delete(l.id)
                onChange({ allowedLanguageIds: [...next] })
              }}
            />
            {l.name}
          </label>
        ))}
      </div>
    </Field>
  )
}
