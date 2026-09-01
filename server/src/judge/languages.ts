/**
 * Cấu hình ngôn ngữ chấm (design.md §3.1, FR-F7/FR-H1).
 *
 * Ở v1 đây là seed cho bảng `languages`; thêm ngôn ngữ = thêm dòng cấu hình +
 * một runner image, không sửa code ứng dụng (NFR-9).
 */

export interface LanguageConfig {
  id: string
  label: string
  image: string
  sourceFilename: string
  /** null = ngôn ngữ thông dịch không có bước biên dịch riêng. */
  compileArgv: string[] | null
  runArgv: string[]
  /** Hệ số nhân giới hạn thời gian (FR-D2). */
  timeFactor: number
  /** Bộ nhớ cộng thêm cho runtime (VM/interpreter) khi thu hẹp lồng (§3.2 phase 3). */
  memoryExtraMb: number
  enabled: boolean
}

export const LANGUAGES = {
  c11: {
    id: 'c11',
    label: 'C (C11, GCC)',
    image: 'bcnjudge-runner-gcc:14',
    sourceFilename: 'main.c',
    compileArgv: ['gcc', '-std=c11', '-O2', '-pipe', '-static', '-s', '-o', '/w/prog', 'main.c', '-lm'],
    runArgv: ['/w/prog'],
    timeFactor: 1,
    memoryExtraMb: 0,
    enabled: true,
  },
  cpp17: {
    id: 'cpp17',
    label: 'C++ 17 (GCC)',
    image: 'bcnjudge-runner-gcc:14',
    sourceFilename: 'main.cpp',
    compileArgv: ['g++', '-std=c++17', '-O2', '-pipe', '-static', '-s', '-o', '/w/prog', 'main.cpp'],
    runArgv: ['/w/prog'],
    timeFactor: 1,
    memoryExtraMb: 0,
    enabled: true,
  },
  python3: {
    id: 'python3',
    label: 'Python 3',
    image: 'bcnjudge-runner-python:3.12',
    sourceFilename: 'main.py',
    // py_compile để lỗi cú pháp thành CE như mọi ngôn ngữ khác (§3.2 phase 2).
    compileArgv: ['python3', '-m', 'py_compile', 'main.py'],
    runArgv: ['python3', 'main.py'],
    timeFactor: 3,
    memoryExtraMb: 64,
    enabled: true,
  },
} as const satisfies Record<string, LanguageConfig>

export type LanguageId = keyof typeof LANGUAGES

export function getLanguage(id: string): LanguageConfig {
  const lang = (LANGUAGES as Record<string, LanguageConfig>)[id]
  if (!lang) throw new Error(`Ngôn ngữ không tồn tại: ${id}`)
  return lang
}
