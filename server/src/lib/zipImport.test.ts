import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  MAX_ZIP_ENTRIES,
  ZipImportError,
  parseTestcaseZip,
  type ZipImportCode,
  type ZipImportOptions,
} from './zipImport'

/** CRC-32 (poly 0xedb88320) — yauzl kiểm CRC nên fixture phải khai đúng. */
function crc32(buf: Buffer): number {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

/**
 * Dựng zip tối thiểu ngay trong test — yauzl chỉ đọc, thêm một dependency chỉ để
 * ghi zip là không đáng. Mặc định STORED (method 0); `deflate:true` cho method 8
 * để phủ đúng đường zip thật (WinRAR/7-Zip luôn nén) và ca zip-bomb.
 */
function makeZip(entries: Array<[string, Buffer | string]>, deflate = false): Buffer {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const [rawName, rawData] of entries) {
    const name = Buffer.from(rawName, 'utf8')
    const data = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData, 'utf8')
    const body = deflate ? deflateRawSync(data) : data
    const method = deflate ? 8 : 0
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    localParts.push(local, name, body)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4) // version made by
    central.writeUInt16LE(20, 6) // version needed
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, name)

    offset += 30 + name.length + body.length
  }

  const local = Buffer.concat(localParts)
  const central = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(central.length, 12)
  eocd.writeUInt32LE(local.length, 16)
  return Buffer.concat([local, central, eocd])
}

const CAPS: ZipImportOptions = {
  maxZipBytes: 1 << 20,
  maxFileBytes: 1 << 16,
  maxTotalBytes: 1 << 18,
}

/** Chạy và bắt lỗi để assert được cả code lẫn tên file trong message. */
async function failure(
  zip: Buffer,
  over: Partial<ZipImportOptions> = {},
): Promise<{ code: ZipImportCode; message: string }> {
  try {
    await parseTestcaseZip(zip, { ...CAPS, ...over })
  } catch (err) {
    if (err instanceof ZipImportError) return { code: err.code, message: err.message }
    throw err
  }
  throw new Error('parseTestcaseZip lẽ ra phải ném ZipImportError')
}

describe('parseTestcaseZip — đường hạnh phúc', () => {
  it('ghép đúng cặp NN.in/NN.out và trả về theo thứ tự position', async () => {
    const zip = makeZip([
      ['03.in', '3\n'],
      ['01.in', '1\n'],
      ['02.out', 'hai\n'],
      ['01.out', 'mot\n'],
      ['03.out', 'ba\n'],
      ['02.in', '2\n'],
    ])

    const parsed = await parseTestcaseZip(zip, CAPS)

    expect(parsed.testcases.map((t) => t.position)).toEqual([1, 2, 3])
    expect(parsed.testcases.map((t) => t.input.toString())).toEqual(['1\n', '2\n', '3\n'])
    expect(parsed.testcases.map((t) => t.expected?.toString())).toEqual(['mot\n', 'hai\n', 'ba\n'])
    expect(parsed.warnings).toEqual([])
  })

  it('"007" → position 7 (parse int, bỏ số 0 đầu) và file rỗng vẫn hợp lệ', async () => {
    const parsed = await parseTestcaseZip(makeZip([['007.in', ''], ['007.out', '']]), CAPS)

    expect(parsed.testcases).toHaveLength(1)
    expect(parsed.testcases[0]!.position).toBe(7)
    expect(parsed.testcases[0]!.input).toHaveLength(0)
    expect(parsed.warnings.join(' ')).toContain('không liên tục')
  })

  it('giải nén được entry deflate (zip thật không dùng STORED)', async () => {
    const zip = makeZip([['01.in', 'x'.repeat(5000)], ['01.out', 'y'.repeat(5000)]], true)

    const parsed = await parseTestcaseZip(zip, CAPS)

    expect(parsed.testcases[0]!.input.toString()).toBe('x'.repeat(5000))
    expect(parsed.testcases[0]!.expected!.toString()).toBe('y'.repeat(5000))
  })
})

describe('parseTestcaseZip — bắt buộc đủ cặp (FR-D4 / FR-D6 S)', () => {
  const orphanIn = makeZip([
    ['01.in', '1\n'],
    ['02.in', '2\n'],
    ['02.out', 'hai\n'],
  ])

  it('.in thiếu .out → missing_pair nêu đúng tên file', async () => {
    const err = await failure(orphanIn)

    expect(err.code).toBe('missing_pair')
    expect(err.message).toContain('01.in')
    expect(err.message).not.toContain('02.in')
  })

  it('generate:true → .in không cặp được nhận, expected null kèm cảnh báo', async () => {
    const parsed = await parseTestcaseZip(orphanIn, { ...CAPS, generate: true })

    expect(parsed.testcases).toEqual([
      { position: 1, input: Buffer.from('1\n'), expected: null },
      { position: 2, input: Buffer.from('2\n'), expected: Buffer.from('hai\n') },
    ])
    expect(parsed.warnings).toHaveLength(1)
    expect(parsed.warnings[0]!).toContain('01.in')
  })

  it('.out mồ côi luôn là lỗi, kể cả generate:true', async () => {
    const zip = makeZip([
      ['01.in', '1\n'],
      ['01.out', 'mot\n'],
      ['02.out', 'hai\n'],
    ])

    for (const generate of [false, true]) {
      const err = await failure(zip, { generate })
      expect(err.code).toBe('missing_pair')
      expect(err.message).toContain('02.out')
    }
  })
})

describe('parseTestcaseZip — tên entry (§8.5: từ chối /, \\, ..)', () => {
  const badNames = ['../x.in', 'a.in', '1.txt', 'tests/01.in', 'tests\\01.in', '0001.in', '01.IN', '0.in']

  for (const name of badNames) {
    it(`từ chối "${name}"`, async () => {
      const err = await failure(makeZip([[name, 'x']]))

      expect(err.code).toBe('bad_entry_name')
      expect(err.message).toContain(name)
    })
  }

  it('từ chối hai entry cùng position (1.in và 01.in)', async () => {
    const err = await failure(makeZip([['1.in', 'a'], ['01.in', 'b']]))

    expect(err.code).toBe('bad_entry_name')
    expect(err.message).toContain('01.in')
    expect(err.message).toContain('1.in')
  })
})

describe('parseTestcaseZip — cap dung lượng nêu rõ file vượt (FR-D4 v0.5)', () => {
  it('cap chính file zip', async () => {
    const zip = makeZip([['01.in', '1\n'], ['01.out', 'mot\n']])

    const err = await failure(zip, { maxZipBytes: zip.length - 1 })

    expect(err.code).toBe('zip_too_large')
    expect(err.message).toContain('vượt giới hạn')
  })

  it('cap mỗi file giải nén — message nêu đúng file vượt', async () => {
    const zip = makeZip([
      ['01.in', '1\n'],
      ['01.out', 'x'.repeat(64)],
    ])

    const err = await failure(zip, { maxFileBytes: 8 })

    expect(err.code).toBe('file_too_large')
    expect(err.message).toContain('01.out')
    expect(err.message).not.toContain('01.in')
  })

  it('cap tổng giải nén — message nêu file làm tràn', async () => {
    const zip = makeZip([
      ['01.in', 'a'.repeat(10)],
      ['01.out', 'b'.repeat(10)],
      ['02.in', 'c'.repeat(10)],
      ['02.out', 'd'.repeat(10)],
    ])

    const err = await failure(zip, { maxFileBytes: 32, maxTotalBytes: 25 })

    expect(err.code).toBe('total_too_large')
    expect(err.message).toContain('02.in')
  })

  it('zip-bomb: entry nén vài trăm byte bung 1 MB bị chặn trước khi giải nén', async () => {
    const zip = makeZip([['01.in', '0'.repeat(1 << 20)], ['01.out', 'ok\n']], true)

    expect(zip.length).toBeLessThan(4096)
    const err = await failure(zip, { maxFileBytes: 1024 })

    expect(err.code).toBe('file_too_large')
    expect(err.message).toContain('01.in')
  })
})

describe('parseTestcaseZip — cap số lượng và zip rỗng', () => {
  it(`quá ${MAX_ZIP_ENTRIES} entry → too_many_entries`, async () => {
    const entries: Array<[string, string]> = []
    for (let i = 1; i <= MAX_ZIP_ENTRIES + 1; i++) entries.push([`${i}.in`, ''])

    const err = await failure(makeZip(entries))

    expect(err.code).toBe('too_many_entries')
    expect(err.message).toContain(String(MAX_ZIP_ENTRIES))
  })

  it('zip không có entry nào → empty_zip', async () => {
    const err = await failure(makeZip([]))

    expect(err.code).toBe('empty_zip')
  })

  it('buffer không phải zip → invalid_zip', async () => {
    const err = await failure(Buffer.from('không phải zip'))

    expect(err.code).toBe('invalid_zip')
  })
})
