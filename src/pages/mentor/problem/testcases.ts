/**
 * Bảng testcase soạn tay (FR-D4) — dữ liệu và luật, tách khỏi component.
 *
 * Ràng buộc quan trọng nhất ở đây là một GIỚI HẠN CÓ THẬT của API, không phải lựa
 * chọn UI: `toMentorProblem()` chỉ trả **2048 byte đầu** của input/expected
 * (`PREVIEW_BYTES`). Mà `PUT /:id/testcases` lại THAY TOÀN BỘ bộ test bằng đúng
 * những gì client gửi lên. Nên nếu để mentor bấm "Lưu" trên một bảng đang chứa bản
 * cắt cụt, testcase 5 MB sẽ âm thầm bị ghi đè bằng 2 KB đầu và bộ test hỏng mà
 * không báo gì. `truncated` tồn tại để chặn đúng đường đó.
 */
import type { MentorTestcaseView, TestcaseKind } from '@/pages/mentor/types'

export interface TestcaseDraft {
  /** Khoá React ổn định qua thêm/xoá dòng — KHÔNG dùng vị trí làm key. */
  key: string
  input: string
  /** `null` = zip nạp với `generate=true`, chờ sinh expected từ lời giải mẫu. */
  expected: string | null
  kind: TestcaseKind
  weight: string
  /** Server cắt bớt nội dung dòng này → cấm lưu cả bảng (xem chú thích đầu file). */
  truncated: boolean
}

let seq = 0
export function draftKey(): string {
  seq += 1
  return `tc-${seq}`
}

const encoder = new TextEncoder()
export function utf8Bytes(text: string): number {
  return encoder.encode(text).length
}

export function emptyDraft(kind: TestcaseKind = 'hidden'): TestcaseDraft {
  return { key: draftKey(), input: '', expected: '', kind, weight: '1', truncated: false }
}

export function toDrafts(testcases: MentorTestcaseView[]): TestcaseDraft[] {
  return testcases.map((t) => ({
    key: `srv-${t.id}`,
    input: t.inputPreview,
    expected: t.expectedPreview,
    kind: t.kind === 'sample' ? 'sample' : 'hidden',
    weight: String(t.weight),
    truncated:
      utf8Bytes(t.inputPreview) < t.inputBytes ||
      (t.expectedBytes !== null && utf8Bytes(t.expectedPreview ?? '') < t.expectedBytes),
  }))
}


export function sampleCount(drafts: TestcaseDraft[]): number {
  return drafts.filter((d) => d.kind === 'sample').length
}

/** Lỗi CHẶN lưu, nói rõ dòng nào — trả `null` khi bảng gửi lên được. */
export function testcaseError(drafts: TestcaseDraft[]): string | null {
  if (drafts.length === 0) return 'Cần ít nhất một testcase.'
  if (drafts.length > 500) return `Có ${drafts.length} testcase, vượt giới hạn 500.`

  const truncated = drafts.flatMap((d, i) => (d.truncated ? [i + 1] : []))
  if (truncated.length > 0) {
    return `Testcase ${truncated.join(', ')} dài quá 2 KB nên máy chủ chỉ gửi về phần đầu. Lưu bảng này sẽ cắt cụt dữ liệu thật — hãy tải lại toàn bộ bằng file zip thay vì sửa tay.`
  }
  const badWeight = drafts.flatMap((d, i) => {
    const w = Number.parseInt(d.weight, 10)
    return Number.isFinite(w) && w >= 1 && w <= 1000 ? [] : [i + 1]
  })
  if (badWeight.length > 0) {
    return `Trọng số của testcase ${badWeight.join(', ')} phải là số nguyên từ 1 đến 1000.`
  }
  return null
}

export function toPutPayload(drafts: TestcaseDraft[]): {
  testcases: { input: string; expected: string | null; kind: TestcaseKind; weight: number }[]
} {
  return {
    testcases: drafts.map((d) => ({
      input: d.input,
      expected: d.expected,
      kind: d.kind,
      weight: Number.parseInt(d.weight, 10),
    })),
  }
}
