/**
 * Chuyển dòng đọc từ `GET /languages` thành body hợp lệ cho `PUT /languages/:id`.
 *
 * Cần lớp chuyển đổi này vì hai đầu KHÔNG khớp kiểu (xem báo cáo lệch API):
 *
 *   · `time_factor` là cột `numeric`, `GET` đọc thô qua `q()` nên node-postgres
 *     trả CHUỖI ("1.00"), còn schema của `PUT` đòi `z.number()` → gửi thẳng lại
 *     là 400.
 *   · `versionLabel`, `cmMode`, `position` nullable trong DB nhưng schema `PUT`
 *     khai `.optional()` chứ không `.nullable()` → `null` cũng là 400. Phải BỎ
 *     HẲN khoá thay vì gửi null.
 *
 * `PUT` là upsert ghi đè toàn bộ hàng, nên bật/tắt một ngôn ngữ vẫn phải gửi đủ
 * mọi trường; thiếu trường nào là mất trường đó.
 */
import type { Language } from './types'

export interface LanguagePayload {
  id: string
  name: string
  versionLabel?: string
  image: string
  sourceFilename: string
  compileArgv: string[] | null
  runArgv: string[]
  timeFactor: number
  memoryExtraMb: number
  cmMode?: string
  enabled: boolean
  position?: number
}

export function toLanguagePayload(lang: Language, overrides: Partial<LanguagePayload> = {}): LanguagePayload {
  const factor = Number(lang.timeFactor)
  const base: LanguagePayload = {
    id: lang.id,
    name: lang.name,
    image: lang.image,
    sourceFilename: lang.sourceFilename,
    compileArgv: lang.compileArgv && lang.compileArgv.length > 0 ? lang.compileArgv : null,
    runArgv: lang.runArgv,
    timeFactor: Number.isFinite(factor) && factor > 0 ? factor : 1,
    memoryExtraMb: lang.memoryExtraMb ?? 0,
    enabled: lang.enabled,
    ...(lang.versionLabel ? { versionLabel: lang.versionLabel } : {}),
    ...(lang.cmMode ? { cmMode: lang.cmMode } : {}),
    ...(lang.position !== null ? { position: lang.position } : {}),
  }
  return { ...base, ...overrides }
}

/**
 * Mỗi dòng là MỘT tham số. Cố ý không tách theo khoảng trắng như shell: đường
 * dẫn có dấu cách và cờ kiểu `-Wl,-rpath,/x y` sẽ vỡ âm thầm, mà lỗi chỉ lộ ra
 * lúc chấm bài thật. Một dòng một tham số thì không có gì để đoán.
 */
export function parseArgv(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function formatArgv(argv: string[] | null): string {
  return (argv ?? []).join('\n')
}
