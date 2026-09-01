/**
 * FR-D7 — lời giải tham khảo lưu kèm bài, **chỉ mentor/admin xem**.
 *
 * Nhãn ở đây không phải trang trí: đây là ô duy nhất trên màn hình mà nội dung gõ
 * vào là đáp án, và mentor cần thấy ngay rằng nó không lọt sang member. Mặc định
 * của cột `solution_visibility` là `'mentor'`, và `mayMemberSeeSolution()` trả
 * `false` cho mọi member ở chế độ đó — câu chữ dưới đây nói đúng hành vi đó, không
 * hứa thêm.
 *
 * Lời giải cũng là ĐẦU VÀO của FR-D6: `POST /:id/validate` chạy chính
 * `solution_source` đã lưu trong DB. Nên ô này và nút Kiểm tra là một cặp, và phải
 * lưu trước khi kiểm (nút Kiểm tra tự chặn khi form còn bẩn).
 */
import { useQuery } from '@tanstack/react-query'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { api } from '@/lib/api'
import type { LanguageOption } from '@/types/api'
import { Field, Notice, Select, Section } from './fields'
import type { ProblemFormValues } from './form'

export function SolutionSection({
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

  return (
    <Section
      title="Lời giải mẫu (chỉ mentor/admin thấy)"
      hint="Member không bao giờ nhận được nội dung này qua API. Đây là thứ hệ thống chạy khi bấm “Kiểm tra bằng lời giải mẫu”."
    >
      <Notice tone="info">
        Lưu lời giải trước rồi mới bấm kiểm — máy chủ chạy bản đã lưu, không phải chữ đang gõ trong ô dưới.
      </Notice>

      <div className="mt-3">
        <Field id="solution-language" label="Ngôn ngữ của lời giải">
          <Select
            id="solution-language"
            value={values.solutionLanguageId}
            onChange={(e) => onChange({ solutionLanguageId: e.target.value })}
          >
            <option value="">— chưa chọn —</option>
            {(languages ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.versionLabel ? ` (${l.versionLabel})` : ''}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Không dùng `<label htmlFor>`: CodeMirror không phải form control, nhãn sẽ
          trỏ vào hư không. Tên đọc được của ô là `ariaLabel` truyền xuống CodeEditor. */}
      <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Mã nguồn lời giải</p>
      <div className="h-64 overflow-hidden rounded-md border border-slate-300 dark:border-slate-600">
        <CodeEditor
          value={values.solutionSource}
          onChange={(v) => onChange({ solutionSource: v })}
          languageId={values.solutionLanguageId}
          ariaLabel="Mã nguồn lời giải mẫu"
        />
      </div>
    </Section>
  )
}
