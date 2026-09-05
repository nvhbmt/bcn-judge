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
  /**
   * Tên file chứa mã NGƯỜI HỌC ở bài dạng function; harness chiếm chỗ
   * `sourceFilename` vì nó mới là điểm vào. null = ngôn ngữ chưa hỗ trợ dạng này.
   */
  functionSourceFilename: string | null
  /** null = dùng lại `compileArgv`. Chỉ khác khi phải nêu đích danh cả hai file. */
  compileArgvFunction: string[] | null
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
    compileArgv: ['gcc', '-std=c11', '-Werror=implicit-function-declaration', '-Werror=implicit-int', '-O2', '-pipe', '-static', '-s', '-o', '/w/prog', 'main.c', '-lm'],
    // Harness `main.c` tự `#include "solution.c"`, nên lệnh biên dịch không đổi.
    functionSourceFilename: 'solution.c',
    compileArgvFunction: null,
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
    functionSourceFilename: 'solution.cpp',
    compileArgvFunction: null,
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
    functionSourceFilename: 'solution.py',
    // Phải kiểm CẢ solution.py, nếu không lỗi cú pháp của người học thành RE lúc
    // import chứ không phải CE — đúng thứ làm người mới học rối nhất.
    compileArgvFunction: ['python3', '-m', 'py_compile', 'solution.py', 'main.py'],
    runArgv: ['python3', 'main.py'],
    timeFactor: 3,
    memoryExtraMb: 64,
    enabled: true,
  },
  // Mức S: image build sẵn nhưng TẮT trong seed — bật ở trang quản trị (US-8).
  java17: {
    id: 'java17',
    label: 'Java 17',
    image: 'bcnjudge-runner-openjdk:17',
    sourceFilename: 'Main.java',
    // -proc:none chặn annotation processor chạy code lúc biên dịch.
    compileArgv: ['javac', '-proc:none', '-d', '/w', 'Main.java'],
    // Tên class công khai phải trùng tên file, nên harness buộc là Main.java còn
    // người học viết class Solution; javac cần nêu đích danh cả hai.
    functionSourceFilename: 'Solution.java',
    compileArgvFunction: ['javac', '-proc:none', '-d', '/w', 'Main.java', 'Solution.java'],
    // JVM tự chọn heap theo RAM container; -XX:-UsePerfData bỏ file /tmp/hsperfdata.
    runArgv: ['java', '-XX:-UsePerfData', '-XX:+UseSerialGC', '-Xss64m', '-cp', '/w', 'Main'],
    timeFactor: 2,
    memoryExtraMb: 256,
    enabled: false,
  },
  node20: {
    id: 'node20',
    label: 'JavaScript (Node 20)',
    image: 'bcnjudge-runner-node:20',
    sourceFilename: 'main.js',
    compileArgv: null,
    functionSourceFilename: 'solution.js',
    // Dạng stdio không có bước biên dịch, nhưng dạng function thì `--check` đáng
    // giá: nó biến lỗi cú pháp của người học thành CE thay vì RE khó hiểu.
    compileArgvFunction: ['node', '--check', 'solution.js'],
    runArgv: ['node', 'main.js'],
    timeFactor: 2,
    memoryExtraMb: 128,
    enabled: false,
  },
} as const satisfies Record<string, LanguageConfig>


export function getLanguage(id: string): LanguageConfig {
  const lang = (LANGUAGES as Record<string, LanguageConfig>)[id]
  if (!lang) throw new Error(`Ngôn ngữ không tồn tại: ${id}`)
  return lang
}
