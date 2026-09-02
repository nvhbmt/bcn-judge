/**
 * FR-D4 — bảng testcase soạn tay: thêm/xoá dòng, mẫu hay ẩn, trọng số.
 *
 * Mỗi dòng là một khối chứ không phải một hàng `<tr>` thật: input và expected là
 * văn bản nhiều dòng có ý nghĩa (khoảng trắng, xuống dòng), nên chúng cần
 * `<textarea>` rộng bằng nửa dòng — nhồi vào ô bảng thì gõ trong một khe 3 cm.
 *
 * Dòng nào server gửi về đã bị cắt (`truncated`) thì bị KHOÁ và tô đỏ: sửa nó
 * chẳng ích gì vì cả bảng đang bị chặn lưu (xem `testcases.ts`), còn để gõ được
 * thì mentor sẽ tưởng mình đang sửa dữ liệu thật.
 */
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { Notice, Select, TextArea, TextInput } from './fields'
import { emptyDraft, sampleCount, utf8Bytes, type TestcaseDraft } from './testcases'

export function TestcaseTable({
  drafts,
  onChange,
}: {
  drafts: TestcaseDraft[]
  onChange: (next: TestcaseDraft[]) => void
}) {
  const patch = (key: string, fields: Partial<TestcaseDraft>) =>
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...fields } : d)))

  const samples = sampleCount(drafts)

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-5">
        <span>
          {drafts.length} testcase · <strong>{samples} mẫu</strong> · {drafts.length - samples} ẩn
        </span>
        <div className="ml-auto flex gap-2">
          <Button onClick={() => onChange([...drafts, emptyDraft()])}>
            <Plus size={15} /> Thêm testcase
          </Button>
        </div>
      </div>

      {drafts.length === 0 ? (
        <Notice tone="info">Chưa có testcase nào. Tải zip ở trên, hoặc bấm “Thêm testcase” để gõ tay.</Notice>
      ) : null}

      <ul className="space-y-2">
        {drafts.map((draft, index) => (
          <li
            key={draft.key}
            className={` border p-2 ${
              draft.truncated ? 'border-[var(--color-wa)] bg-[var(--tint-clay)]/50' : 'border-line'
            }`}
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-semibold">#{index + 1}</span>

              <label className="sr-only" htmlFor={`${draft.key}-kind`}>
                Loại testcase #{index + 1}
              </label>
              <Select
                id={`${draft.key}-kind`}
                value={draft.kind}
                disabled={draft.truncated}
                onChange={(e) => patch(draft.key, { kind: e.target.value === 'sample' ? 'sample' : 'hidden' })}
                className="max-w-32 py-1"
              >
                <option value="sample">Mẫu (member thấy)</option>
                <option value="hidden">Ẩn</option>
              </Select>

              <label htmlFor={`${draft.key}-weight`} className="text-ink-5">
                Trọng số
              </label>
              <TextInput
                id={`${draft.key}-weight`}
                type="number"
                min={1}
                max={1000}
                value={draft.weight}
                disabled={draft.truncated}
                onChange={(e) => patch(draft.key, { weight: e.target.value })}
                className="max-w-20 py-1"
              />

              <span className="text-ink-6">
                {utf8Bytes(draft.input)} B vào · {draft.expected === null ? 'chưa có' : `${utf8Bytes(draft.expected)} B`} ra
              </span>

              <Button
                variant="danger"
                onClick={() => onChange(drafts.filter((d) => d.key !== draft.key))}
                className="ml-auto px-2 py-1"
                aria-label={`Xoá testcase #${index + 1}`}
              >
                <Trash2 size={14} />
              </Button>
            </div>

            {draft.truncated ? (
              <p className="mb-1.5 text-xs text-[var(--color-wa)]">
                Máy chủ chỉ gửi về 2 KB đầu của testcase này nên không sửa tay được. Muốn đổi thì tải lại cả bộ
                test bằng zip.
              </p>
            ) : null}

            {draft.expected === null ? (
              <p className="mb-1.5 text-xs text-earth">
                Chưa có expected output (nạp từ zip với tuỳ chọn sinh sau). Gõ vào đây, hoặc để trống và dùng lời
                giải mẫu.
              </p>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor={`${draft.key}-in`} className="mb-0.5 block text-xs text-ink-5">
                  Input
                </label>
                <TextArea
                  id={`${draft.key}-in`}
                  rows={3}
                  value={draft.input}
                  readOnly={draft.truncated}
                  onChange={(e) => patch(draft.key, { input: e.target.value })}
                  className="text-xs"
                />
              </div>
              <div>
                <label htmlFor={`${draft.key}-out`} className="mb-0.5 block text-xs text-ink-5">
                  Expected output
                </label>
                <TextArea
                  id={`${draft.key}-out`}
                  rows={3}
                  value={draft.expected ?? ''}
                  readOnly={draft.truncated}
                  onChange={(e) => patch(draft.key, { expected: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
