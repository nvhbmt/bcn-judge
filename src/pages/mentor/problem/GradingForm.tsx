/**
 * Tab "Chấm" — mọi thứ quyết định bài được CHẤM thế nào: giới hạn, độ khó, dạng
 * bài, cách so output, ngôn ngữ được nộp. Nhịp sửa của cụm này là "đặt một lần",
 * khác hẳn nội dung đề sửa liên tục — vì thế nó là một tab, không phải phần đuôi
 * của một cuộn dài (xem EditorTabs.tsx).
 */
import { Field, Section, Select, TextInput } from '@/pages/mentor/fields'
import type { ProblemFormValues } from '@/pages/mentor/form'
import { LanguageAllowedField } from './LanguageAllowedField'
import { COMPARE_MODE_LABEL, type CompareMode, type Difficulty, type ProblemKind } from '@/pages/mentor/types'

export function GradingForm({
  values,
  onChange,
}: {
  values: ProblemFormValues
  onChange: (patch: Partial<ProblemFormValues>) => void
}) {
  return (
    <div className="px-4 py-4">
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
            hint="function = người học chỉ viết một hàm, ghép với harness (tab Harness sẽ hiện ra)"
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
    </div>
  )
}
