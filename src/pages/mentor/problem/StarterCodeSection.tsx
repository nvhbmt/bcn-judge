/**
 * FR-D3 — code khởi tạo theo từng ngôn ngữ.
 *
 * Member mở bài là editor nạp sẵn `starterCode[languageId]` (WorkspacePage), nghĩa
 * là phía tiêu thụ đã sống từ lâu — nhưng mentor không có ô nào để viết nó, nên
 * trường chỉ đặt được qua seed hoặc nạp .docx. Section này là nửa còn thiếu.
 *
 * Cùng khuôn với HarnessSection: một ô chọn ngôn ngữ + một editor cho ngôn ngữ đang
 * chọn, dấu ✓ cho ngôn ngữ đã có nội dung. Gửi đi là gửi CẢ map (form.ts lo) vì
 * server ghi đè nguyên cột jsonb — gửi một phần là xoá starter của ngôn ngữ khác.
 *
 * Với bài dạng function, starter code chính là chỗ dán CHỮ KÝ HÀM cho member —
 * thiếu nó thì "chỉ viết một hàm theo mẫu có sẵn" là mẫu không tồn tại.
 */
import { useQuery } from '@tanstack/react-query'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { api } from '@/lib/api'
import { Field, Section, Select } from '@/pages/mentor/fields'
import type { ProblemFormValues } from '@/pages/mentor/form'
import type { LanguageOption } from '@/types/api'

export function StarterCodeSection({
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
  const current = values.starterLanguageId

  return (
    <Section
      title="Code khởi tạo (tuỳ chọn)"
      hint="Member mở bài là thấy sẵn đoạn này trong editor, theo đúng ngôn ngữ họ chọn. Ngôn ngữ không có starter thì editor mở trống."
    >
      <Field id="starter-language" label="Soạn cho ngôn ngữ">
        <Select
          id="starter-language"
          value={current}
          onChange={(e) => onChange({ starterLanguageId: e.target.value })}
        >
          <option value="">— chọn ngôn ngữ —</option>
          {(languages ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {values.starterCode[l.id]?.trim() ? ' ✓ đã có' : ''}
            </option>
          ))}
        </Select>
      </Field>

      {current ? (
        <div className="mt-2 h-48 overflow-hidden border border-line">
          <CodeEditor
            languageId={current}
            value={values.starterCode[current] ?? ''}
            onChange={(src) => onChange({ starterCode: { ...values.starterCode, [current]: src } })}
            ariaLabel={`Code khởi tạo cho ${current}`}
          />
        </div>
      ) : null}
    </Section>
  )
}
