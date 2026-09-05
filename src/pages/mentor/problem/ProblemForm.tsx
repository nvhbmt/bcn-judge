/**
 * FR-D1 — tab "Đề bài": phần NỘI DUNG, thứ mentor sửa liên tục.
 *
 * Từng là cả trang form (nội dung + giới hạn + code + lời giải nối đuôi trong một
 * cuộn dài); nay mỗi nhịp sửa là một tab riêng — xem EditorTabs.tsx. File này chỉ
 * còn đúng những trường mà khung xem trước bên phải dựng sống được.
 */
import { Field, Section, TextArea, TextInput } from '@/pages/mentor/fields'
import type { ProblemFormValues } from '@/pages/mentor/form'

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

    </div>
  )
}
