/**
 * FR-D10 — bài dạng **function** (kiểu LeetCode): người học chỉ viết một hàm,
 * hệ thống ghép với harness của mentor rồi biên dịch thành một chương trình.
 *
 * Harness là điểm vào: nó đọc stdin, gọi hàm của người học, in kết quả ra stdout.
 * Sau khi ghép, chương trình chạy y hệt bài stdio — nên mọi thứ bên dưới (hàng
 * đợi, chấm điểm, xếp hạng) không phân biệt hai dạng.
 *
 * Hai điều phải nói thẳng trên màn hình, vì sai chỗ này rất tốn kém:
 *   1. Harness KHÔNG được tự phán đúng/sai. Nó chạy chung sandbox với code không
 *      tin được, nên nếu nó in "PASS" thì người học xoá hàm đi và in "PASS" là
 *      xong. Chỉ in giá trị trả về; verdict do máy chủ quyết ở ngoài.
 *   2. Mỗi ngôn ngữ một harness riêng, và tên file là cố định — mentor phải biết
 *      chính xác tên file để `#include` / `import` cho đúng.
 */
import { useQuery } from '@tanstack/react-query'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { api } from '@/lib/api'
import type { LanguageOption } from '@/types/api'
import { Field, Notice, Section, Select } from './fields'
import type { ProblemFormValues } from './form'

/** Khớp `languages.function_source_filename` ở máy chủ (drizzle/0003). */
const MEMBER_FILE: Record<string, string> = {
  c11: 'solution.c',
  cpp17: 'solution.cpp',
  python3: 'solution.py',
  java17: 'Solution.java',
  node20: 'solution.js',
}

const HOW_TO_INCLUDE: Record<string, string> = {
  c11: '#include "solution.c"',
  cpp17: '#include "solution.cpp"',
  python3: 'from solution import Solution',
  java17: 'gọi thẳng class Solution — javac biên dịch cả hai file',
  node20: 'const { ham } = require("./solution.js")',
}

export function HarnessSection({
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

  const supported = (languages ?? []).filter((l) => MEMBER_FILE[l.id])
  const current = values.harnessLanguageId
  const written = Object.entries(values.harness).filter(([, src]) => src.trim().length > 0)

  return (
    <Section
      title="Harness cho bài dạng function"
      hint="Mỗi ngôn ngữ một harness. Ngôn ngữ chưa có harness thì người học không nộp bằng ngôn ngữ đó được."
    >
      <Notice tone="warn">
        Harness chỉ được <strong>in ra giá trị trả về</strong>. Đừng cho nó tự in “đúng/sai”: nó chạy chung
        sandbox với code của người học, nên câu đó giả mạo được.
      </Notice>

      <div className="mt-3">
        <Field id="harness-language" label="Soạn harness cho ngôn ngữ">
          <Select
            id="harness-language"
            value={current}
            onChange={(e) => onChange({ harnessLanguageId: e.target.value })}
          >
            <option value="">— chọn ngôn ngữ —</option>
            {supported.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {values.harness[l.id]?.trim() ? ' ✓ đã có' : ' — chưa có'}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {current && MEMBER_FILE[current] ? (
        <>
          <p className="mb-2 text-xs text-slate-600 dark:text-slate-300">
            Mã của người học nằm ở{' '}
            <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800">{MEMBER_FILE[current]}</code>. Trong
            harness, lấy nó vào bằng{' '}
            <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800">{HOW_TO_INCLUDE[current]}</code>.
          </p>
          <div className="h-64 overflow-hidden rounded-md border border-slate-300 dark:border-slate-600">
            <CodeEditor
              value={values.harness[current] ?? ''}
              onChange={(v) => onChange({ harness: { ...values.harness, [current]: v } })}
              languageId={current}
              ariaLabel={`Harness cho ${current}`}
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">Chọn một ngôn ngữ để soạn harness.</p>
      )}

      {written.length === 0 ? (
        <Notice tone="error">Bài dạng function phải có harness cho ít nhất một ngôn ngữ thì mới lưu được.</Notice>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          Đã có harness cho: {written.map(([id]) => id).join(', ')}.
        </p>
      )}
    </Section>
  )
}
