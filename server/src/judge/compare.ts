/**
 * So sánh output (design.md §3.4 dòng 6, FR-D5 v0.5).
 *
 * Mọi chế độ đều chuẩn hoá CRLF/CR → LF ở CẢ HAI phía trước khi so
 * (FR-D5 v0.5 — output sinh trên Windows không được tính là WA).
 */
import type { CompareMode } from './types'

export interface CompareResult {
  ok: boolean
  /** Dòng khác biệt đầu tiên, đánh số từ 1; null khi khớp. */
  firstDiffLine: number | null
}

const OK: CompareResult = { ok: true, firstDiffLine: null }

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/** rstrip từng dòng + bỏ các dòng trống ở cuối. */
function trimLines(text: string): string[] {
  const lines = normalizeNewlines(text).split('\n').map((line) => line.replace(/[ \t\f\v]+$/, ''))
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

function compareTrim(actual: string, expected: string): CompareResult {
  const a = trimLines(actual)
  const b = trimLines(expected)
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return { ok: false, firstDiffLine: i + 1 }
  }
  return OK
}

function compareExact(actual: string, expected: string): CompareResult {
  const a = normalizeNewlines(actual)
  const b = normalizeNewlines(expected)
  if (a === b) return OK
  const al = a.split('\n')
  const bl = b.split('\n')
  const n = Math.max(al.length, bl.length)
  for (let i = 0; i < n; i++) {
    if (al[i] !== bl[i]) return { ok: false, firstDiffLine: i + 1 }
  }
  return { ok: false, firstDiffLine: null }
}

function compareFloat(actual: string, expected: string, eps: number): CompareResult {
  const a = trimLines(actual)
  const b = trimLines(expected)
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const at = (a[i] ?? '').split(/\s+/).filter(Boolean)
    const bt = (b[i] ?? '').split(/\s+/).filter(Boolean)
    if (at.length !== bt.length) return { ok: false, firstDiffLine: i + 1 }
    for (let j = 0; j < at.length; j++) {
      const x = at[j]!
      const y = bt[j]!
      if (x === y) continue
      const nx = Number(x)
      const ny = Number(y)
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return { ok: false, firstDiffLine: i + 1 }
      const diff = Math.abs(nx - ny)
      const rel = diff / Math.max(1, Math.abs(ny))
      if (diff > eps && rel > eps) return { ok: false, firstDiffLine: i + 1 }
    }
  }
  return OK
}

export function compareOutput(
  actual: Buffer | string,
  expected: Buffer | string,
  mode: CompareMode = 'trim',
  floatEps = 1e-6,
): CompareResult {
  const a = typeof actual === 'string' ? actual : actual.toString('utf8')
  const b = typeof expected === 'string' ? expected : expected.toString('utf8')
  switch (mode) {
    case 'exact':
      return compareExact(a, b)
    case 'float':
      return compareFloat(a, b, floatEps)
    case 'trim':
    default:
      return compareTrim(a, b)
  }
}
