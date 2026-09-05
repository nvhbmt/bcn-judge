/**
 * FR-D1 — khung trái của trình soạn bài: các trường của đề bài.
 *
 * Chia làm ba mục vì ba mục đó thay đổi với ba nhịp khác nhau: nội dung đề sửa
 * liên tục, giới hạn chấm đặt một lần, lời giải mẫu dán một lần rồi chỉ đụng lại
 * khi kiểm hỏng.
 */
import { Field, Section, Select, TextArea, TextInput } from '@/pages/mentor/fields'
import type { ProblemFormValues } from '@/pages/mentor/form'
import { HarnessSection } from './HarnessSection'
import { LanguageAllowedField } from './LanguageAllowedField'
import { StarterCodeSection } from './StarterCodeSection'
import { SolutionSection } from './SolutionSection'
import { COMPARE_MODE_LABEL, type CompareMode, type Difficulty, type ProblemKind } from '@/pages/mentor/types'

export function ProblemForm({
  values,
  onChange,
}: {
  values: ProblemFormValues
  onChange: (patch: Partial<ProblemFormValues>) => void
}) {
  return (
    <div className="px-4 py-4">
      <Section title="Nội dung đề">
        <Field id="f-title" label="Tiêu đề">
          <TextInput
            id="f-title"
            value={values.title}
            maxLength={200}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>

        <Field id="f-statement" label="Đề bài">
          <TextArea
            id="f-statement"
            rows={12}
            value={values.statementMd}
            onChange={(e) => onChange({ statementMd: e.target.value })}
          />
        </Field>

        <Field id="f-input" label="Mô tả dữ liệu vào">
          <TextArea
            id="f-input"
            rows={4}
            value={values.inputDescMd}
            onChange={(e) => onChange({ inputDescMd: e.target.value })}
          />
        </Field>

        <Field id="f-output" label="Mô tả kết quả ra">
          <TextArea
            id="f-output"
            rows={4}
            value={values.outputDescMd}
            onChange={(e) => onChange({ outputDescMd: e.target.value })}
          />
        </Field>

        <Field id="f-constraints" label="Ràng buộc">
          <TextArea
            id="f-constraints"
            rows={4}
            value={values.constraintsMd}
            onChange={(e) => onChange({ constraintsMd: e.target.value })}
          />
        </Field>

        {/* FR-D1 bắt buộc có tags, mà trước đây form KHÔNG có ô này: server nhận,
            lưu, trả về — chỉ giao diện là câm. Tag chỉ đặt được qua seed hoặc nạp
            .docx, còn mentor soạn tay thì không có đường nào. */}
        <Field
          id="f-tags"
          label="Thẻ (tag)"
          hint="Phân cách bằng dấu phẩy — ví dụ: số học, vòng lặp, sàng. Tối đa 20 tag, mỗi tag 40 ký tự. Xoá hết chữ rồi lưu là bỏ hết tag."
        >
          <TextInput
            id="f-tags"
            value={values.tags}
            aria-describedby="f-tags-hint"
            onChange={(e) => onChange({ tags: e.target.value })}
          />
        </Field>
      </Section>

      <Section
        title="Giới hạn chấm"
        hint="Bài mới thừa hưởng mặc định của hệ thống. Lưu ở đây là GHIM giá trị cho riêng bài này — về sau admin đổi mặc định hệ thống thì bài này không đổi theo nữa."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="f-time" label="Thời gian (ms)" hint="100 – 60000">
            <TextInput
              id="f-time"
              type="number"
              min={100}
              max={60000}
              value={values.timeLimitMs}
              aria-describedby="f-time-hint"
              onChange={(e) => onChange({ timeLimitMs: e.target.value })}
            />
          </Field>
          <Field id="f-memory" label="Bộ nhớ (MB)" hint="16 – 2048">
            <TextInput
              id="f-memory"
              type="number"
              min={16}
              max={2048}
              value={values.memoryLimitMb}
              aria-describedby="f-memory-hint"
              onChange={(e) => onChange({ memoryLimitMb: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="f-difficulty"
            label="Độ khó"
            hint={values.difficulty === '' ? 'Chưa đặt. Chọn rồi thì không bỏ trống lại được (API không nhận giá trị rỗng).' : undefined}
          >
            <Select
              id="f-difficulty"
              value={values.difficulty}
              aria-describedby={values.difficulty === '' ? 'f-difficulty-hint' : undefined}
              onChange={(e) => onChange({ difficulty: e.target.value as '' | Difficulty })}
            >
              {/* Chỉ còn hiện lựa chọn rỗng khi bài đang thật sự chưa đặt độ khó:
                  PATCH dùng COALESCE nên gửi rỗng không xoá được gì (xem form.ts). */}
              {values.difficulty === '' ? <option value="">— chưa đặt —</option> : null}
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
            </Select>
          </Field>

          <Field
            id="f-kind"
            label="Dạng bài"
            hint="function = người học chỉ viết một hàm, ghép với harness bên dưới"
          >
            <Select
              id="f-kind"
              value={values.kind}
              onChange={(e) => onChange({ kind: e.target.value as ProblemKind })}
            >
              <option value="stdio">Chương trình trọn vẹn (đọc stdin, in stdout)</option>
              <option value="function">Chỉ một hàm (kiểu LeetCode)</option>
            </Select>
          </Field>
          <Field id="f-compare" label="Cách so sánh output">
            <Select
              id="f-compare"
              value={values.compareMode}
              onChange={(e) => onChange({ compareMode: e.target.value as CompareMode })}
            >
              {(Object.keys(COMPARE_MODE_LABEL) as CompareMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {COMPARE_MODE_LABEL[mode]}
                </option>
              ))}
            </Select>
          </Field>

          {/* Chỉ hiện khi so số thực. Select ở trên cho chọn 'float' từ lâu mà không
              có chỗ đặt dung sai — nửa cái tính năng: mentor chọn xong đứng nhìn,
              còn máy chấm âm thầm dùng 1e-6. */}
          {values.compareMode === 'float' ? (
            <Field id="f-eps" label="Dung sai số thực" hint="Bỏ trống = 1e-6. |a − b| ≤ eps là coi như bằng.">
              <TextInput
                id="f-eps"
                inputMode="decimal"
                placeholder="1e-6"
                value={values.floatEps}
                aria-describedby="f-eps-hint"
                onChange={(e) => onChange({ floatEps: e.target.value })}
              />
            </Field>
          ) : null}
        </div>

        <LanguageAllowedField values={values} onChange={onChange} />
      </Section>

      <StarterCodeSection values={values} onChange={onChange} />

      {/* FR-D10: chỉ hiện khi bài ở dạng function — bài stdio không có harness. */}
      {values.kind === 'function' ? <HarnessSection values={values} onChange={onChange} /> : null}

      <SolutionSection values={values} onChange={onChange} />
    </div>
  )
}
