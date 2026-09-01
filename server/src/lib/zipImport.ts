/**
 * Đọc zip testcase mentor upload (design.md §8.5, FR-D4 v0.5).
 *
 * Zip là dữ liệu người ngoài đưa vào nên mọi cap phải chặn TRƯỚC khi tốn bộ nhớ:
 * cỡ file nén kiểm ngay trên buffer, cỡ giải nén kiểm theo từng chunk lúc stream
 * (zip-bomb khai vài KB nén mà bung ra hàng GB — không bao giờ được giữ quá cap
 * trong RAM rồi mới đo).
 *
 * Hàm chỉ trả về khi TOÀN BỘ zip đã hợp lệ: caller ghi bytea trong một
 * transaction duy nhất, không được ghi nửa bộ test rồi mới phát hiện thiếu cặp.
 *
 * Mọi lỗi vượt cap đều nêu đúng tên file vi phạm — FR-D4 v0.5 yêu cầu nguyên văn.
 */
import { fromBuffer, type Entry, type ZipFile } from 'yauzl'

export type ZipImportCode =
  | 'zip_too_large'
  | 'file_too_large'
  | 'total_too_large'
  | 'bad_entry_name'
  | 'missing_pair'
  | 'too_many_entries'
  | 'empty_zip'
  | 'invalid_zip'

export class ZipImportError extends Error {
  readonly code: ZipImportCode

  constructor(code: ZipImportCode, message: string) {
    super(message)
    this.name = 'ZipImportError'
    this.code = code
  }
}

export interface ParsedTestcase {
  position: number
  input: Buffer
  /** NULL khi chỉ có .in và request khai generate=true (§2.3 — chờ FR-D6 S điền). */
  expected: Buffer | null
}

export interface ParsedTestcases {
  testcases: ParsedTestcase[]
  warnings: string[]
}

export interface ZipImportOptions {
  maxZipBytes: number
  maxFileBytes: number
  maxTotalBytes: number
  /** FR-D6 S: cho phép entry .in không cặp, expected sinh sau từ lời giải mẫu. */
  generate?: boolean
}

/** §8.5: cap 500 entry — chặn zip vài vạn file trước khi đọc byte dữ liệu nào. */
export const MAX_ZIP_ENTRIES = 500

/**
 * Chỉ nhận NN.in / NN.out. Regex neo hai đầu nên `/`, `\`, `..`, `.txt`, entry
 * thư mục đều rớt — không cần thêm lớp lọc path traversal riêng.
 */
const ENTRY_NAME = /^(\d{1,3})\.(in|out)$/

interface NamedFile {
  /** Tên gốc trong zip, để thông báo lỗi trỏ đúng file người dùng thấy. */
  name: string
  data: Buffer
}

export async function parseTestcaseZip(
  zipBuffer: Buffer,
  opts: ZipImportOptions,
): Promise<ParsedTestcases> {
  if (zipBuffer.length > opts.maxZipBytes) {
    throw new ZipImportError(
      'zip_too_large',
      `File zip ${fmtBytes(zipBuffer.length)} vượt giới hạn ${fmtBytes(opts.maxZipBytes)}.`,
    )
  }

  const zip = await openZip(zipBuffer)
  const inputs = new Map<number, NamedFile>()
  const expected = new Map<number, NamedFile>()

  try {
    if (zip.entryCount === 0) {
      throw new ZipImportError('empty_zip', 'File zip rỗng — cần ít nhất một cặp NN.in/NN.out.')
    }
    if (zip.entryCount > MAX_ZIP_ENTRIES) {
      throw new ZipImportError(
        'too_many_entries',
        `File zip chứa ${zip.entryCount} entry, vượt giới hạn ${MAX_ZIP_ENTRIES} entry.`,
      )
    }

    let total = 0
    for (let entry = await nextEntry(zip); entry !== null; entry = await nextEntry(zip)) {
      const name = safeName(entry.fileNameRaw.toString('utf8'))
      const matched = ENTRY_NAME.exec(name)
      if (matched === null) {
        throw new ZipImportError(
          'bad_entry_name',
          `Entry "${name}" không hợp lệ — chỉ nhận NN.in/NN.out (ví dụ 01.in, 01.out), không thư mục, không đường dẫn.`,
        )
      }
      const position = Number(matched[1])
      if (position === 0) {
        throw new ZipImportError(
          'bad_entry_name',
          `Entry "${name}" không hợp lệ — số thứ tự testcase bắt đầu từ 1.`,
        )
      }
      const bucket = matched[2] === 'in' ? inputs : expected
      const clash = bucket.get(position)
      if (clash !== undefined) {
        throw new ZipImportError(
          'bad_entry_name',
          `Entry "${name}" trùng số thứ tự với "${clash.name}".`,
        )
      }

      const data = await readEntryBytes(zip, entry, name, opts, total)
      total += data.length
      bucket.set(position, { name, data })
    }

    const strays = [...expected.entries()].filter(([pos]) => !inputs.has(pos)).map(([, f]) => f.name)
    if (strays.length > 0) {
      throw new ZipImportError(
        'missing_pair',
        `Thiếu file input cho: ${fmtList(strays)}. Mỗi NN.out phải có NN.in đi kèm.`,
      )
    }

    const positions = [...inputs.keys()].sort((a, b) => a - b)
    const orphans = positions.filter((pos) => !expected.has(pos)).map((pos) => inputs.get(pos)!.name)
    if (orphans.length > 0 && opts.generate !== true) {
      throw new ZipImportError(
        'missing_pair',
        `Thiếu file expected cho: ${fmtList(orphans)}. Khai generate=true nếu muốn sinh expected từ lời giải mẫu (FR-D6).`,
      )
    }

    const warnings: string[] = []
    if (orphans.length > 0) {
      warnings.push(
        `${orphans.length} testcase chưa có .out (${fmtList(orphans)}) — expected để trống, chờ sinh từ lời giải mẫu.`,
      )
    }
    if (positions.some((pos, i) => pos !== i + 1)) {
      warnings.push(
        `Số thứ tự testcase không liên tục: ${fmtList(positions.map(String))} — giữ nguyên theo tên file.`,
      )
    }

    return {
      testcases: positions.map((position) => ({
        position,
        input: inputs.get(position)!.data,
        expected: expected.get(position)?.data ?? null,
      })),
      warnings,
    }
  } finally {
    zip.close()
  }
}

function openZip(buffer: Buffer): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    // decodeStrings:false → yauzl bỏ qua validate tên của chính nó và để nguyên
    // fileNameRaw; ta tự kiểm bằng ENTRY_NAME (chặt hơn hẳn) nên lỗi tên file
    // luôn là ZipImportError tiếng Việt có nêu tên, không phải Error tiếng Anh của yauzl.
    fromBuffer(buffer, { lazyEntries: true, decodeStrings: false }, (err, zipfile) => {
      if (err) reject(new ZipImportError('invalid_zip', `Không đọc được file zip: ${err.message}`))
      else resolve(zipfile)
    })
  })
}

/** Một entry mỗi lần (lazyEntries) — null khi hết. */
function nextEntry(zip: ZipFile): Promise<Entry | null> {
  return new Promise((resolve, reject) => {
    const detach = (): void => {
      zip.off('entry', onEntry)
      zip.off('end', onEnd)
      zip.off('error', onError)
    }
    const onEntry = (entry: Entry): void => {
      detach()
      resolve(entry)
    }
    const onEnd = (): void => {
      detach()
      resolve(null)
    }
    const onError = (err: Error): void => {
      detach()
      reject(new ZipImportError('invalid_zip', `File zip hỏng: ${err.message}`))
    }
    zip.on('entry', onEntry)
    zip.on('end', onEnd)
    zip.on('error', onError)
    zip.readEntry()
  })
}

function readEntryBytes(
  zip: ZipFile,
  entry: Entry,
  name: string,
  opts: ZipImportOptions,
  totalSoFar: number,
): Promise<Buffer> {
  // Kích thước khai trong central directory chặn zip-bomb trước khi giải nén byte
  // nào; vẫn phải đo lại lúc stream vì header hoàn toàn có thể nói dối.
  const declared = capExceeded(entry.uncompressedSize, totalSoFar, name, opts)
  if (declared !== null) return Promise.reject(declared)

  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => {
      if (err) {
        reject(new ZipImportError('invalid_zip', `Không giải nén được "${name}": ${err.message}`))
        return
      }
      const chunks: Buffer[] = []
      let size = 0
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length
        const exceeded = capExceeded(size, totalSoFar, name, opts)
        if (exceeded !== null) {
          stream.destroy()
          reject(exceeded)
          return
        }
        chunks.push(chunk)
      })
      stream.on('error', (e: Error) => {
        reject(new ZipImportError('invalid_zip', `Lỗi khi đọc "${name}": ${e.message}`))
      })
      stream.on('end', () => resolve(Buffer.concat(chunks)))
    })
  })
}

function capExceeded(
  size: number,
  totalSoFar: number,
  name: string,
  opts: ZipImportOptions,
): ZipImportError | null {
  if (size > opts.maxFileBytes) {
    return new ZipImportError(
      'file_too_large',
      `File "${name}" giải nén ra ${fmtBytes(size)}, vượt giới hạn ${fmtBytes(opts.maxFileBytes)} mỗi file.`,
    )
  }
  if (totalSoFar + size > opts.maxTotalBytes) {
    return new ZipImportError(
      'total_too_large',
      `Tổng dung lượng giải nén vượt giới hạn ${fmtBytes(opts.maxTotalBytes)} tại file "${name}".`,
    )
  }
  return null
}

/** Tên entry do người upload đặt — cắt ngắn và bỏ ký tự điều khiển trước khi ghép vào thông báo/log. */
function safeName(raw: string): string {
  const cut = raw.length > 120 ? `${raw.slice(0, 120)}…` : raw
  return cut.replace(/[\u0000-\u001f\u007f]/g, '?')
}

function fmtBytes(n: number): string {
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${n} byte`
}

/** Liệt kê tối đa 10 tên — một zip 500 file không được đẻ ra thông báo lỗi 500 dòng. */
function fmtList(names: string[]): string {
  const head = names.slice(0, 10).join(', ')
  return names.length > 10 ? `${head} (+${names.length - 10} file nữa)` : head
}
