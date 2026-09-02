/**
 * Khung phải của trang sửa contest: bài trong contest, mỗi bài một HÀNG sửa được tại
 * chỗ — nhãn, điểm, đổi vị trí, gỡ, lối sang trình soạn bài (FR-I2).
 *
 * Hai điều đáng biết:
 *
 *  1. **Nạp sẵn bài ĐANG có.** `PUT /:id/problems` thay thế cả bộ, nên form khởi đầu
 *     rỗng đồng nghĩa "mở ra rồi bấm lưu là gỡ sạch bài". State chỉ lấy `initial` một
 *     lần, nên chỗ gọi phải chờ tải xong rồi mới dựng component (dùng `key`).
 *  2. **Lưu là lưu CẢ BỘ.** Sửa tại chỗ từng hàng chỉ đổi state trong màn hình; nút
 *     lưu gửi nguyên mảng, đúng ngữ nghĩa của endpoint.
 */
import { Plus, Save } from 'lucide-react'
import { useId, useState } from 'react'
import { Button, EmptyState, SectionRule } from '@/components/ui'
import { ContestProblemRow } from './ContestProblemRow'
import { defaultLabel, moved, toPayload, validateDrafts } from './contestProblems'
import { Field, Notice, Select } from './fields'
import type { ContestProblemDraft } from './mentorTypes'
import { isValidated, type MentorProblemRow } from './types'

export function ContestProblemPanel({
  bank,
  initial,
  lockedIds,
  pending,
  onSave,
}: {
  bank: MentorProblemRow[]
  initial: ContestProblemDraft[]
  /** problemId của những bài đã có người nộp — server từ chối gỡ. */
  lockedIds: string[]
  pending: boolean
  onSave: (problems: { problemId: string; label: string; maxScore: number }[]) => void
}) {
  const pickId = useId()
  const [drafts, setDrafts] = useState<ContestProblemDraft[]>(initial)
  const [picked, setPicked] = useState('')
  const [error, setError] = useState<string | null>(null)

  const locked = new Set(lockedIds)
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
    const next = moved(drafts, index, delta)
    if (next) setDrafts(next)
  }

  function save() {
    const problem = validateDrafts(drafts)
    if (problem) return setError(problem)
    setError(null)
    onSave(toPayload(drafts))
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-3">
        <SectionRule label="Bài trong contest" />
        {/* Endpoint thay thế cả bộ, nên phải nói rõ: thứ còn lại trong danh sách là
            thứ contest sẽ có. Form nạp sẵn rồi nhưng ngữ nghĩa lưu thì không đổi. */}
        <Notice tone="warn">
          Danh sách dưới là bài contest <b>đang có</b>, và <b>lưu là thay thế toàn bộ</b>: bài nào bạn gỡ
          khỏi đây sẽ bị gỡ khỏi contest.
        </Notice>

        <div className="my-3 flex items-end gap-2">
          <div className="flex-1">
            <Field id={pickId} label="Thêm bài từ ngân hàng">
              <Select id={pickId} value={picked} onChange={(e) => setPicked(e.currentTarget.value)}>
                <option value="">— Chọn bài —</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} — {p.testcases} testcase,{' '}
                    {p.testcases === 0 ? 'chưa có testcase' : isValidated(p) ? 'đã kiểm' : 'chưa kiểm'}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button onClick={add} disabled={!picked} className="mb-3">
            <Plus size={15} /> Thêm
          </Button>
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {drafts.length === 0 ? (
          <EmptyState title="Chưa chọn bài nào" hint="Thứ tự trong danh sách chính là thứ tự bài trong contest." />
        ) : (
          <ul aria-label="Bài trong contest" className="border-t border-line">
            {drafts.map((d, i) => (
              <ContestProblemRow
                key={d.problemId}
                draft={d}
                index={i}
                total={drafts.length}
                locked={locked.has(d.problemId)}
                onPatch={(part) => setDrafts((list) => list.map((x, k) => (k === i ? { ...x, ...part } : x)))}
                onMove={(delta) => move(i, delta)}
                onRemove={() => setDrafts((list) => list.filter((_, k) => k !== i))}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-line px-4 py-2">
        <Button variant="primary" onClick={save} disabled={pending}>
          <Save size={16} /> {pending ? 'Đang lưu…' : `Lưu ${drafts.length} bài`}
        </Button>
      </div>
    </section>
  )
}
