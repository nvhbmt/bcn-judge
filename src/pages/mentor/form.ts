/**
 * Giá trị form của trình soạn bài + phép dịch sang payload `PATCH /api/mentor/problems/:id`.
 *
 * Tách khỏi component vì hai luật dưới đây là *hợp đồng với API*, không phải chuyện
 * trình bày, và phải kiểm được bằng test thuần:
 *
 *   1. Mọi ô số giữ dạng CHUỖI. Ô `number` rỗng đọc ra `''`; ép sang `Number` ngay
 *      lúc gõ thì xoá hết ký tự sẽ hoá thành 0 và người soạn thấy "0 ms" nhảy vào ô.
 *   2. PATCH của server dùng `COALESCE(<giá trị>, cột)` nên **không có cách gửi NULL**:
 *      trường không gửi = giữ nguyên. Vì vậy chỉ gửi trường THỰC SỰ đổi, và độ khó
 *      bỏ trống là "giữ nguyên" chứ không phải "xoá".
 */
import type { CompareMode, Difficulty, MentorProblemDetail, ProblemKind } from './types'

export interface ProblemFormValues {
  title: string
  /** 'function' = người học chỉ viết một hàm, ghép với harness rồi biên dịch. */
  kind: ProblemKind
  /** {languageId: harness}. Mỗi ngôn ngữ một bản, vì cách ghép khác nhau. */
  harness: Record<string, string>
  /** Ngôn ngữ đang được soạn harness — chỉ là trạng thái màn hình, không gửi đi. */
  harnessLanguageId: string
  statementMd: string
  inputDescMd: string
  outputDescMd: string
  constraintsMd: string
  timeLimitMs: string
  memoryLimitMb: string
  difficulty: '' | Difficulty
  /**
   * Thẻ tag, giữ NGUYÊN chuỗi người soạn gõ ("số học, vòng lặp"). Dịch sang mảng
   * bằng `parseTags` đúng lúc gửi — cùng lý do với luật 1 ở đầu file: chuẩn hoá
   * ngay lúc gõ thì dấu phẩy vừa gõ ra đã bị nuốt và không ai gõ nổi tag thứ hai.
   */
  tags: string
  /**
   * null = mọi ngôn ngữ đang bật. Mảng ứng với các ô đã tick. KHÔNG cho tồn tại
   * mảng rỗng ở trạng thái gửi đi: [] nghĩa là "cấm nộp toàn bộ" và server cũng
   * chặn từ zod — validateForm dịch điều đó thành câu tiếng người trước.
   */
  allowedLanguageIds: string[] | null
  compareMode: CompareMode
  /** Dung sai của compareMode='float', giữ dạng CHUỖI theo luật 1. Rỗng = mặc định 1e-6. */
  floatEps: string
  solutionVisibility: 'mentor' | 'after_ac' | 'after_contest'
  /** {languageId: code khởi tạo} — member mở bài là thấy sẵn trong editor (FR-D3). */
  starterCode: Record<string, string>
  /** Ngôn ngữ đang soạn starter code — trạng thái màn hình, không gửi đi. */
  starterLanguageId: string
  solutionLanguageId: string
  solutionSource: string
}

const COMPARE_MODES: CompareMode[] = ['trim', 'exact', 'float']
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
const VISIBILITIES = ['mentor', 'after_ac', 'after_contest'] as const

export function toFormValues(detail: MentorProblemDetail): ProblemFormValues {
  return {
    title: detail.title,
    kind: detail.kind === 'function' ? 'function' : 'stdio',
    harness: detail.harness ?? {},
    harnessLanguageId: Object.keys(detail.harness ?? {})[0] ?? detail.solutionLanguageId ?? '',
    statementMd: detail.statementMd,
    inputDescMd: detail.inputDescMd ?? '',
    outputDescMd: detail.outputDescMd ?? '',
    constraintsMd: detail.constraintsMd ?? '',
    timeLimitMs: String(detail.timeLimitMs),
    memoryLimitMb: String(detail.memoryLimitMb),
    difficulty: DIFFICULTIES.find((d) => d === detail.difficulty) ?? '',
    tags: detail.tags.join(', '),
    allowedLanguageIds: detail.allowedLanguageIds,
    compareMode: COMPARE_MODES.find((m) => m === detail.compareMode) ?? 'trim',
    floatEps: detail.floatEps === null ? '' : String(detail.floatEps),
    solutionVisibility: VISIBILITIES.find((v) => v === detail.solutionVisibility) ?? 'mentor',
    starterCode: detail.starterCode ?? {},
    starterLanguageId: Object.keys(detail.starterCode ?? {})[0] ?? '',
    solutionLanguageId: detail.solutionLanguageId ?? '',
    solutionSource: detail.solutionSource ?? '',
  }
}

/**
 * "số học, vòng lặp , ,sàng" → ['số học', 'vòng lặp', 'sàng'].
 * Bỏ mẩu rỗng và mẩu trùng — gõ thừa dấu phẩy không thành tag ma.
 */
export function parseTags(raw: string): string[] {
  return [...new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))]
}

/** Kiểm ở FE để lỗi nói tiếng người: zod của server chỉ trả "Dữ liệu không hợp lệ." */
export function validateForm(v: ProblemFormValues): string | null {
  // Chặn ở FE để mentor thấy ngay; máy chủ vẫn kiểm lại (checkFunctionShape).
  if (v.kind === 'function' && !Object.values(v.harness).some((src) => src.trim().length > 0)) {
    return 'Bài dạng function phải có harness cho ít nhất một ngôn ngữ.'
  }
  const title = v.title.trim()
  if (title.length === 0) return 'Tiêu đề không được để trống.'
  if (title.length > 200) return 'Tiêu đề tối đa 200 ký tự.'
  if (v.statementMd.trim().length === 0) return 'Đề bài không được để trống.'

  const time = Number.parseInt(v.timeLimitMs, 10)
  if (!Number.isFinite(time) || time < 100 || time > 60_000) {
    return 'Giới hạn thời gian phải là số nguyên từ 100 đến 60000 ms.'
  }
  const memory = Number.parseInt(v.memoryLimitMb, 10)
  if (!Number.isFinite(memory) || memory < 16 || memory > 2048) {
    return 'Giới hạn bộ nhớ phải là số nguyên từ 16 đến 2048 MB.'
  }
  if (v.allowedLanguageIds !== null && v.allowedLanguageIds.length === 0) {
    return 'Bỏ tick hết ngôn ngữ là không ai nộp được bài này — muốn cho mọi ngôn ngữ thì tick "Mọi ngôn ngữ".'
  }
  if (v.compareMode === 'float' && v.floatEps.trim() !== '') {
    const eps = Number(v.floatEps)
    if (!Number.isFinite(eps) || eps <= 0 || eps > 1) {
      return 'Dung sai số thực phải là số dương ≤ 1 (bỏ trống thì dùng mặc định 1e-6).'
    }
  }
  const tags = parseTags(v.tags)
  if (tags.length > 20) return 'Tối đa 20 tag mỗi bài.'
  const daiQua = tags.find((t) => t.length > 40)
  if (daiQua) return `Tag "${daiQua.slice(0, 40)}…" dài quá 40 ký tự.`
  // FR-D6 cần CẢ HAI mới chạy kiểm được; thiếu ngôn ngữ thì lời giải dán vào là vô dụng.
  if (v.solutionSource.trim().length > 0 && v.solutionLanguageId === '') {
    return 'Đã có lời giải mẫu thì phải chọn ngôn ngữ của lời giải.'
  }
  return null
}

const TEXT_FIELDS = [
  'statementMd',
  'inputDescMd',
  'outputDescMd',
  'constraintsMd',
  'solutionSource',
  'solutionLanguageId',
] as const

/** Chỉ những trường đã đổi — xem luật 2 ở đầu file. */
export function toPatchPayload(
  initial: ProblemFormValues,
  current: ProblemFormValues,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (current.title.trim() !== initial.title.trim()) patch.title = current.title.trim()
  for (const key of TEXT_FIELDS) {
    if (current[key] !== initial[key]) patch[key] = current[key]
  }
  if (current.compareMode !== initial.compareMode) patch.compareMode = current.compareMode
  if (current.kind !== initial.kind) patch.kind = current.kind
  // Gửi cả map khi có bất kỳ ngôn ngữ nào đổi: server ghi đè nguyên cột jsonb, nên
  // gửi một phần là xoá mất harness của những ngôn ngữ còn lại.
  if (JSON.stringify(current.harness) !== JSON.stringify(initial.harness)) {
    patch.harness = Object.fromEntries(
      Object.entries(current.harness).filter(([, src]) => src.trim().length > 0),
    )
  }
  // So SAU chuẩn hoá: xáo khoảng trắng hay dấu phẩy thừa không phải là thay đổi.
  // Khác độ khó, tags XOÁ được: PATCH của server đi vòng qua jsonb thay vì COALESCE,
  // và mảng rỗng bên JS là truthy nên `[]` gửi lên nghĩa là "xoá hết" — cố ý dùng.
  if (JSON.stringify(parseTags(current.tags)) !== JSON.stringify(parseTags(initial.tags))) {
    patch.tags = parseTags(current.tags)
  }
  // null XOÁ ĐƯỢC về "mọi ngôn ngữ": PATCH của server phân biệt vắng mặt / null / mảng.
  if (JSON.stringify(current.allowedLanguageIds) !== JSON.stringify(initial.allowedLanguageIds)) {
    patch.allowedLanguageIds = current.allowedLanguageIds
  }
  const eps = Number(current.floatEps)
  if (current.floatEps !== initial.floatEps && current.floatEps.trim() !== '' && Number.isFinite(eps)) {
    patch.floatEps = eps
  }
  if (current.solutionVisibility !== initial.solutionVisibility) {
    patch.solutionVisibility = current.solutionVisibility
  }
  // Cùng luật với harness: gửi CẢ map vì server ghi đè nguyên cột jsonb.
  if (JSON.stringify(current.starterCode) !== JSON.stringify(initial.starterCode)) {
    patch.starterCode = Object.fromEntries(
      Object.entries(current.starterCode).filter(([, src]) => src.trim().length > 0),
    )
  }
  // Độ khó rỗng KHÔNG gửi: schema là enum nên `''` bị 400, và COALESCE không xoá được.
  if (current.difficulty !== initial.difficulty && current.difficulty !== '') {
    patch.difficulty = current.difficulty
  }
  const time = Number.parseInt(current.timeLimitMs, 10)
  if (current.timeLimitMs !== initial.timeLimitMs && Number.isFinite(time)) patch.timeLimitMs = time
  const memory = Number.parseInt(current.memoryLimitMb, 10)
  if (current.memoryLimitMb !== initial.memoryLimitMb && Number.isFinite(memory)) {
    patch.memoryLimitMb = memory
  }
  return patch
}

/** Đề bài ghép lại đúng thứ tự FR-D1 để khung xem trước hiện y như member sẽ đọc. */
