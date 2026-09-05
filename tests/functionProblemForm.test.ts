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
import { parseTags, toFormValues, toPatchPayload, validateForm, type ProblemFormValues } from '@/pages/mentor/form'
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
  floatEps: null,
  starterCode: {},
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

  // Sáu nhánh dưới đây trước không có ca nào — chỉ nhánh harness và nhánh null được
  // đi qua. Xoá hẳn khối kiểm `timeLimitMs` thì 114 test vẫn xanh, mà hệ quả là mentor
  // lưu được `timeLimitMs = 0` và MỌI người học TLE toàn bài.
  const stdio = (over: Partial<ProblemFormValues> = {}): ProblemFormValues => ({
    ...toFormValues(detail({ kind: 'stdio', harness: {} })),
    ...over,
  })

  it.each([
    ['tiêu đề rỗng', { title: '   ' }, /Tiêu đề/],
    ['tiêu đề quá 200 ký tự', { title: 'x'.repeat(201) }, /200/],
    ['đề bài rỗng', { statementMd: '  ' }, /Đề bài/],
    ['thời gian dưới cận', { timeLimitMs: '99' }, /thời gian/i],
    ['thời gian trên cận', { timeLimitMs: '60001' }, /thời gian/i],
    ['thời gian không phải số', { timeLimitMs: 'abc' }, /thời gian/i],
    ['bộ nhớ dưới cận', { memoryLimitMb: '15' }, /bộ nhớ/i],
    ['bộ nhớ trên cận', { memoryLimitMb: '2049' }, /bộ nhớ/i],
    ['có lời giải mà thiếu ngôn ngữ', { solutionSource: 'int main(){}', solutionLanguageId: '' }, /ngôn ngữ/i],
  ])('chặn: %s', (_ten, over, mau) => {
    expect(validateForm(stdio(over as Partial<ProblemFormValues>))).toMatch(mau)
  })

  it.each([
    ['đúng cận dưới', { timeLimitMs: '100', memoryLimitMb: '16' }],
    ['đúng cận trên', { timeLimitMs: '60000', memoryLimitMb: '2048' }],
  ])('cho qua: %s', (_ten, over) => {
    // Đối chứng hai đầu mút: chặn không được chặn nhầm giá trị hợp lệ.
    expect(validateForm(stdio(over as Partial<ProblemFormValues>))).toBeNull()
  })
})

describe('tags — FR-D1 bắt buộc có, mà form từng không có ô nào', () => {
  // Server nhận, lưu và trả tags từ đầu; chỉ giao diện là câm. Ba phép canh dưới đây
  // giữ vòng đời: nạp về dạng gõ được → chỉ gửi khi THẬT SỰ đổi → xoá được.

  it('nạp mảng tag từ API thành chuỗi gõ được, phân cách phẩy', () => {
    const v = toFormValues(detail({ tags: ['số học', 'vòng lặp', 'sàng'] }))
    expect(v.tags).toBe('số học, vòng lặp, sàng')
  })

  it('parseTags dọn dấu phẩy thừa, khoảng trắng và mẩu trùng', () => {
    expect(parseTags(' số học,, vòng lặp ,sàng, số học ')).toEqual(['số học', 'vòng lặp', 'sàng'])
    expect(parseTags('')).toEqual([])
  })

  it('đổi tag thì gửi MẢNG đã chuẩn hoá; xáo khoảng trắng thì không gửi gì', () => {
    const init = toFormValues(detail({ tags: ['số học'] }))

    expect(toPatchPayload(init, { ...init, tags: 'số học,  đệ quy' }).tags).toEqual(['số học', 'đệ quy'])
    // Cùng bộ tag, chỉ khác cách gõ — không phải thay đổi, không được gửi.
    expect(toPatchPayload(init, { ...init, tags: '  số học , ' })).not.toHaveProperty('tags')
  })

  it('xoá hết chữ rồi lưu là gửi [] — server hiểu là bỏ hết tag', () => {
    const init = toFormValues(detail({ tags: ['số học'] }))
    expect(toPatchPayload(init, { ...init, tags: '' }).tags).toEqual([])
  })

  it('chặn quá 20 tag và tag dài quá 40 ký tự bằng câu tiếng người', () => {
    const v = toFormValues(detail())
    const nhieu = Array.from({ length: 21 }, (_, i) => `t${i}`).join(', ')
    expect(validateForm({ ...v, tags: nhieu })).toContain('Tối đa 20 tag')
    expect(validateForm({ ...v, tags: 'x'.repeat(41) })).toContain('dài quá 40 ký tự')
    expect(validateForm({ ...v, tags: 'số học, sàng' })).toBeNull()
  })
})

describe('bốn trường từng chết trên giao diện — FR-D2/D3/D5/D7', () => {
  it('ngôn ngữ: siết rồi MỞ LẠI được — null gửi đi đúng nghĩa "mọi ngôn ngữ"', () => {
    const init = toFormValues(detail({ allowedLanguageIds: null }))
    expect(toPatchPayload(init, { ...init, allowedLanguageIds: ['c11'] }).allowedLanguageIds).toEqual(['c11'])

    const daSiet = toFormValues(detail({ allowedLanguageIds: ['c11'] }))
    expect(toPatchPayload(daSiet, { ...daSiet, allowedLanguageIds: null }).allowedLanguageIds).toBeNull()
    expect(toPatchPayload(daSiet, { ...daSiet })).not.toHaveProperty('allowedLanguageIds')
  })

  it('ngôn ngữ: bỏ tick hết bị chặn bằng câu tiếng người, không phải lỗi zod', () => {
    const v = toFormValues(detail())
    expect(validateForm({ ...v, allowedLanguageIds: [] })).toContain('không ai nộp được')
    expect(validateForm({ ...v, allowedLanguageIds: ['c11'] })).toBeNull()
  })

  it('floatEps: chỉ gửi khi là số hợp lệ và THẬT SỰ đổi; sai thì chặn từ FE', () => {
    const init = toFormValues(detail({ compareMode: 'float', floatEps: null }))
    expect(init.floatEps).toBe('')

    expect(toPatchPayload(init, { ...init, floatEps: '0.001' }).floatEps).toBe(0.001)
    expect(toPatchPayload(init, { ...init, floatEps: '' })).not.toHaveProperty('floatEps')

    expect(validateForm({ ...init, floatEps: '-1' })).toContain('Dung sai')
    expect(validateForm({ ...init, floatEps: 'abc' })).toContain('Dung sai')
    // Không ở chế độ float thì ô không hiện, giá trị cũ không được phép chặn lưu.
    expect(validateForm({ ...init, compareMode: 'trim', floatEps: 'abc' })).toBeNull()
  })

  it('solutionVisibility: nạp từ API, đổi thì gửi, giá trị lạ rơi về mentor', () => {
    const init = toFormValues(detail({ solutionVisibility: 'after_ac' }))
    expect(init.solutionVisibility).toBe('after_ac')
    expect(toFormValues(detail({ solutionVisibility: 'gi-do-la' })).solutionVisibility).toBe('mentor')

    expect(toPatchPayload(init, { ...init, solutionVisibility: 'after_contest' }).solutionVisibility)
      .toBe('after_contest')
    expect(toPatchPayload(init, { ...init })).not.toHaveProperty('solutionVisibility')
  })

  it('starterCode: gửi CẢ map như harness, lọc ngôn ngữ rỗng — không xoá nhầm của ngôn ngữ khác', () => {
    const init = toFormValues(detail({ starterCode: { c11: 'int ham(int);' } }))
    const patch = toPatchPayload(init, {
      ...init,
      starterCode: { ...init.starterCode, python3: 'def ham(n): ...', cpp17: '   ' },
    })
    expect(patch.starterCode).toEqual({ c11: 'int ham(int);', python3: 'def ham(n): ...' })
    expect(toPatchPayload(init, { ...init })).not.toHaveProperty('starterCode')
  })
})
