/**
 * Lọc log biên dịch trước khi trả cho người học (§3.2, NFR-2).
 *
 * Hai việc, và việc thứ hai mới là việc quan trọng:
 *
 *  1. Bỏ tiền tố `/w/` — đường dẫn bên trong container không có nghĩa gì với người
 *     học, chỉ làm thông báo khó đọc.
 *  2. **Giấu mọi chẩn đoán thuộc file của mentor.** Ở bài dạng function, harness do
 *     mentor viết được biên dịch chung với mã người học. Trình biên dịch khi báo
 *     lỗi sẽ IN LẠI DÒNG NGUỒN gây lỗi — nên một lỗi trong harness đẩy thẳng mã
 *     harness ra cho member. Đó là rò dữ liệu mentor qua đúng cái đường mà không
 *     ai nghĩ tới, và kèm theo là đổ oan: người học tưởng mình sai.
 *
 * Cách lọc: trình biên dịch nào cũng mở đầu một khối chẩn đoán bằng dòng có
 * `tên_file:số_dòng`, rồi các dòng phụ (mũi tên, trích nguồn) không nhắc tên file
 * nữa. Vì vậy bám theo "file đang được nói tới": dòng nào nêu tên file thì đổi ngữ
 * cảnh, dòng nào không nêu thì thuộc về khối trước đó.
 */

const EXT = 'c|cc|cpp|cxx|h|hpp|py|java|js|mjs|cjs'

/** Nhận tên file trong một dòng chẩn đoán, phủ cả 5 trình biên dịch đang dùng. */
function fileMentionedIn(line: string): string | null {
  // Python: File "solution.py", line 3
  const py = /File "([^"]+)"/.exec(line)
  if (py?.[1]) return basename(py[1])
  // GCC/G++/javac/node: [đường dẫn/]tên.ext:123 — cũng khớp "In file included from x.c:2:"
  const generic = new RegExp(`(^|[\\s(])([\\w./+-]+\\.(?:${EXT})):\\d+`).exec(line)
  if (generic?.[2]) return basename(generic[2])
  // Dòng tiêu đề ngữ cảnh của GCC KHÔNG có số dòng: `main.c: In function 'main':`.
  // Bỏ sót nó là bỏ sót cả khối lỗi phía sau, kể cả dòng trích mã harness.
  const header = new RegExp(`^([\\w./+-]+\\.(?:${EXT})):`).exec(line)
  if (header?.[1]) return basename(header[1])
  const included = /included from ([\w./+-]+\.\w+)/.exec(line)
  if (included?.[1]) return basename(included[1])
  return null
}

function basename(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

export interface SanitizeResult {
  text: string
  /** true khi đã giấu ít nhất một khối chẩn đoán thuộc file của mentor. */
  hidMentorDiagnostics: boolean
}

/**
 * @param mentorFiles Tên file KHÔNG do người học viết (harness). Rỗng ở bài stdio.
 */
export function sanitizeCompileOutput(raw: string, mentorFiles: string[]): SanitizeResult {
  const hidden = new Set(mentorFiles.map(basename))
  const kept: string[] = []
  let hidMentorDiagnostics = false
  // null = chưa biết thuộc file nào; giữ lại, vì có thể là lỗi chung (hết bộ nhớ,
  // linker không tìm thấy symbol) mà người học vẫn cần thấy.
  let context: string | null = null

  for (const line of raw.split('\n')) {
    const mentioned = fileMentionedIn(line)
    if (mentioned) context = mentioned
    if (context !== null && hidden.has(context)) {
      hidMentorDiagnostics = true
      continue
    }
    kept.push(line.replaceAll('/w/', ''))
  }

  return { text: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), hidMentorDiagnostics }
}

const MENTOR_FAULT =
  'Lỗi nằm ở phần khung do người ra đề viết, không phải ở bài của bạn. Hãy báo lại cho mentor.'

/** Ghép thông điệp cuối cùng cho người học. */
export function compileMessageForMember(raw: string, mentorFiles: string[]): string {
  const { text, hidMentorDiagnostics } = sanitizeCompileOutput(raw, mentorFiles)
  if (!hidMentorDiagnostics) return text
  // Giấu hết mà không còn gì: đừng để người học nhìn màn hình trống rồi tự trách.
  return text.length === 0 ? MENTOR_FAULT : `${text}\n\n${MENTOR_FAULT}`
}
