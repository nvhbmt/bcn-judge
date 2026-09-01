/**
 * FR-I2: chọn bài cho contest, đặt thứ tự / nhãn / điểm tối đa.
 * THỨ TỰ TRONG MẢNG CHÍNH LÀ `position` — server đánh số lại 1..n theo index.
 */
import { useId, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Save, X } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'
import { Field, Notice, Select, TextInput } from './fields'
import type { ContestProblemDraft } from './mentorTypes'
import { isValidated, type MentorProblemRow } from './types'
import { swapped } from './useCourseContent'

/** Nhãn mặc định A, B, C… theo vị trí — đúng thói quen đề thi. */
const defaultLabel = (index: number): string => String.fromCharCode(65 + (index % 26))

function validate(drafts: ContestProblemDraft[]): string | null {
  if (drafts.length === 0) return 'Chọn ít nhất một bài trước khi lưu.'
  for (const d of drafts) {
    if (d.label.length > 4) return `Nhãn "${d.label}" dài quá 4 ký tự.`
    const score = Number.parseInt(d.maxScore, 10)
    if (!Number.isFinite(score) || score < 1 || score > 10_000) {
      return `Điểm tối đa của bài "${d.title}" phải là số nguyên từ 1 đến 10000.`
    }
  }
  return null
}

export function ContestProblemPicker({
  bank,
  existingCount,
  pending,
  onSave,
}: {
  bank: MentorProblemRow[]
  existingCount: number
  pending: boolean
  onSave: (problems: { problemId: string; label: string; maxScore: number }[]) => void
}) {
  const pickId = useId()
  const [drafts, setDrafts] = useState<ContestProblemDraft[]>([])
  const [picked, setPicked] = useState('')
  const [error, setError] = useState<string | null>(null)

  const chosen = new Set(drafts.map((d) => d.problemId))
  const available = bank.filter((p) => !chosen.has(p.id))

  function add() {
    const problem = bank.find((p) => p.id === picked)
    if (!problem || chosen.has(problem.id)) return
    setDrafts((list) => [
      ...list,
      { problemId: problem.id, title: problem.title, label: defaultLabel(list.length), maxScore: '100' },
    ])
    setPicked('')
  }

  function move(index: number, delta: -1 | 1) {
    const next = swapped(drafts, index, delta)
    if (next) setDrafts(next)
  }

  function patch(index: number, part: Partial<ContestProblemDraft>) {
    setDrafts((list) => list.map((d, i) => (i === index ? { ...d, ...part } : d)))
  }

  function save() {
    const problem = validate(drafts)
    if (problem) return setError(problem)
    setError(null)
    onSave(
      drafts.map((d) => ({ problemId: d.problemId, label: d.label, maxScore: Number.parseInt(d.maxScore, 10) })),
    )
  }

  return (
    <section className="border border-line bg-surface-2 p-4">
      <h2 className="mb-1 text-sm font-semibold">Bài trong contest</h2>
      {/* Không có API đọc danh sách bài hiện tại của contest, mà PUT thì THAY THẾ
          toàn bộ — nói thẳng để không ai vô tình gỡ sạch bài của contest đang chạy. */}
      <Notice tone="warn">
        Danh sách này luôn mở ra trống (API chưa trả bài của contest về) và <b>lưu là thay thế toàn bộ</b>.
        {existingCount > 0
          ? ` Contest đang có ${existingCount} bài: bài nào không có trong danh sách dưới sẽ bị gỡ (trừ bài đã có người nộp).`
          : ''}
      </Notice>

      <div className="my-3 flex items-end gap-2">
        <div className="flex-1">
          <Field id={pickId} label="Thêm bài từ ngân hàng">
            <Select id={pickId} value={picked} onChange={(e) => setPicked(e.currentTarget.value)}>
              <option value="">— Chọn bài —</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} — {p.testcases} testcase, {p.testcases === 0 ? 'chưa có testcase' : isValidated(p) ? 'đã kiểm' : 'chưa kiểm'}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button onClick={add} disabled={!picked} className="mb-3">
          <Plus size={15} /> Thêm
        </Button>
      </div>

      {drafts.length === 0 ? (
        <EmptyState title="Chưa chọn bài nào" hint="Thứ tự trong danh sách chính là thứ tự bài trong contest." />
      ) : (
        <ol className="grid gap-2">
          {drafts.map((d, i) => (
            <li key={d.problemId} className="flex items-center gap-2 bg-surface-1 px-2 py-1.5">
              <span className="w-6 text-center font-mono text-xs text-ink-5">{i + 1}</span>
              <TextInput
                value={d.label}
                maxLength={4}
                aria-label={`Nhãn của bài ${d.title}`}
                className="w-16"
                onChange={(e) => patch(i, { label: e.currentTarget.value })}
              />
              <span className="min-w-0 flex-1 truncate text-sm">{d.title}</span>
              <TextInput
                type="number"
                min={1}
                max={10_000}
                value={d.maxScore}
                aria-label={`Điểm tối đa của bài ${d.title}`}
                className="w-24"
                onChange={(e) => patch(i, { maxScore: e.currentTarget.value })}
              />
              <Button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Đưa bài ${d.title} lên trên`} className="px-1.5">
                <ArrowUp size={14} />
              </Button>
              <Button
                onClick={() => move(i, 1)}
                disabled={i === drafts.length - 1}
                aria-label={`Đưa bài ${d.title} xuống dưới`}
                className="px-1.5"
              >
                <ArrowDown size={14} />
              </Button>
              <Button
                variant="danger"
                onClick={() => setDrafts((list) => list.filter((_, j) => j !== i))}
                aria-label={`Bỏ bài ${d.title} khỏi contest`}
                className="px-1.5"
              >
                <X size={14} />
              </Button>
            </li>
          ))}
        </ol>
      )}

      {error ? (
        <div className="mt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      <div className="mt-3">
        <Button variant="primary" onClick={save} disabled={pending || drafts.length === 0}>
          <Save size={15} /> {pending ? 'Đang lưu…' : `Lưu ${drafts.length} bài`}
        </Button>
      </div>
    </section>
  )
}
