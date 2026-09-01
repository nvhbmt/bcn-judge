/**
 * FR-D10 — hợp đồng giữa form soạn bài và API cho bài dạng function.
 *
 * Ba luật ở đây đều là chuyện đúng/sai dữ liệu, không phải trình bày, nên phải
 * kiểm được mà không cần dựng React:
 *
 *  1. Harness gửi đi phải là CẢ map. Server ghi đè nguyên cột jsonb, nên gửi một
 *     ngôn ngữ là xoá mất harness của những ngôn ngữ còn lại.
 *  2. Ngôn ngữ có harness rỗng phải bị lọc bỏ trước khi gửi — nếu không, ràng
 *     buộc "bài function phải có harness" ở server tưởng là đã có.
 *  3. Không đổi harness thì không gửi trường đó, vì PATCH dùng COALESCE.
 */
import { describe, expect, it } from 'vitest'
import { toFormValues, toPatchPayload, validateForm, type ProblemFormValues } from '@/pages/mentor/form'
import type { MentorProblemDetail } from '@/pages/mentor/types'

const detail = (over: Partial<MentorProblemDetail> = {}): MentorProblemDetail => ({
  id: 'p1',
  title: 'Two Sum',
  kind: 'function',
  harness: { c11: '#include "solution.c"\nint main(void){return 0;}\n' },
  statementMd: 'Đề',
  inputDescMd: null,
  outputDescMd: null,
  constraintsMd: null,
  timeLimitMs: 1000,
  memoryLimitMb: 256,
  difficulty: 'easy',
  tags: [],
  allowedLanguageIds: null,
  compareMode: 'trim',
  testcaseRev: 1,
  solutionLanguageId: 'c11',
  solutionSource: '',
  solutionVisibility: 'mentor',
  hiddenTestcaseCount: 2,
  testcases: [],
  ...over,
})

describe('form bài dạng function — FR-D10', () => {
  it('nạp kind và harness từ API, chọn sẵn ngôn ngữ đã có harness', () => {
    const v = toFormValues(detail())

    expect(v.kind).toBe('function')
    expect(v.harness.c11).toContain('solution.c')
    expect(v.harnessLanguageId).toBe('c11')
  })

  it('bài stdio không có harness thì ô soạn harness không chọn sẵn gì', () => {
    const v = toFormValues(detail({ kind: 'stdio', harness: {}, solutionLanguageId: null }))

    expect(v.kind).toBe('stdio')
    expect(v.harnessLanguageId).toBe('')
  })

  it('gửi CẢ map harness, không phải riêng ngôn ngữ vừa sửa', () => {
    const initial = toFormValues(detail({ harness: { c11: 'A', python3: 'B' } }))
    const current: ProblemFormValues = { ...initial, harness: { ...initial.harness, c11: 'A sửa' } }

    const patch = toPatchPayload(initial, current)

    expect(patch.harness).toEqual({ c11: 'A sửa', python3: 'B' })
  })

  it('lọc bỏ ngôn ngữ có harness rỗng trước khi gửi', () => {
    const initial = toFormValues(detail({ harness: { c11: 'A' } }))
    const current: ProblemFormValues = { ...initial, harness: { c11: 'A', python3: '   \n' } }

    expect(toPatchPayload(initial, current).harness).toEqual({ c11: 'A' })
  })

  it('không đổi harness thì không gửi trường đó', () => {
    const initial = toFormValues(detail())

    expect(toPatchPayload(initial, { ...initial, title: 'Tên khác' })).not.toHaveProperty('harness')
  })

  it('đổi dạng bài thì gửi kind', () => {
    const initial = toFormValues(detail({ kind: 'stdio', harness: {} }))
    const current: ProblemFormValues = { ...initial, kind: 'function', harness: { c11: 'A' } }

    const patch = toPatchPayload(initial, current)

    expect(patch.kind).toBe('function')
    expect(patch.harness).toEqual({ c11: 'A' })
  })

  it('chặn lưu bài function chưa có harness nào', () => {
    const v = toFormValues(detail({ harness: {} }))

    expect(validateForm(v)).toMatch(/harness/i)
  })

  it('bài stdio không bị đòi harness', () => {
    const v = toFormValues(detail({ kind: 'stdio', harness: {} }))

    expect(validateForm(v)).toBeNull()
  })
})
