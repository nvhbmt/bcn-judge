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
import { Field, Notice, Select, Section } from '@/pages/mentor/fields'
import type { ProblemFormValues } from '@/pages/mentor/form'

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
    <Section title="Lời giải mẫu">
      <Notice tone="info">
        Lưu lời giải trước rồi mới bấm kiểm — máy chủ chạy bản đã lưu, không phải chữ đang gõ trong ô dưới.
      </Notice>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
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

        {/* FR-D7: ai được thấy lời giải, và TỪ LÚC NÀO. Server thi hành bằng
            mayMemberSeeSolution() từ lâu; thiếu ô này thì mọi bài kẹt ở 'mentor'
            và vế (S) của FR-D7 — "cho member xem sau khi AC / sau contest" —
            không bao giờ bật được từ giao diện. */}
        <Field
          id="solution-visibility"
          label="Ai thấy lời giải"
          hint={
            values.solutionVisibility === 'mentor'
              ? undefined
              : 'Member đủ điều kiện sẽ đọc được TOÀN VĂN lời giải này — cân nhắc trước khi mở.'
          }
        >
          <Select
            id="solution-visibility"
            value={values.solutionVisibility}
            aria-describedby={values.solutionVisibility === 'mentor' ? undefined : 'solution-visibility-hint'}
            onChange={(e) =>
              onChange({ solutionVisibility: e.target.value as ProblemFormValues['solutionVisibility'] })
            }
          >
            <option value="mentor">Chỉ mentor/admin</option>
            <option value="after_ac">Member thấy sau khi AC bài này</option>
            <option value="after_contest">Member thấy sau khi contest kết thúc</option>
          </Select>
        </Field>
      </div>

      {/* Không dùng `<label htmlFor>`: CodeMirror không phải form control, nhãn sẽ
          trỏ vào hư không. Tên đọc được của ô là `ariaLabel` truyền xuống CodeEditor. */}
      <p className="mb-1 text-xs font-semibold text-ink-3">Mã nguồn lời giải</p>
      <div className="h-64 overflow-hidden border border-line-strong">
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
