/**
 * Bộ đóng ZIP tối giản, KHÔNG nén (method "store").
 *
 * Vì sao tự viết thay vì kéo một thư viện: gói tải bài nộp chỉ toàn text nhỏ, nén hay
 * không chẳng khác mấy; còn cả dự án giữ ít dependency (migration viết tay, không lib
 * thừa). Store-only + CRC32 đúng chuẩn PKZIP, mọi công cụ giải nén đều mở được.
 *
 * Chỉ dùng cho tên file ASCII (đã qua vnSlug) nên không bật cờ UTF-8 — đủ và gọn.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  name: string
  data: Uint8Array
}

/** Trả về một Buffer là file .zip hoàn chỉnh (store-only). */
export function zipStore(entries: ZipEntry[]): Buffer {
  const enc = new TextEncoder()
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0

  for (const e of entries) {
    const nameBytes = Buffer.from(enc.encode(e.name))
    const data = Buffer.from(e.data)
    const crc = crc32(e.data)
    const size = data.length

    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0) // chữ ký local file header
    lh.writeUInt16LE(20, 4) // version cần để giải nén (2.0)
    lh.writeUInt16LE(0, 6) // cờ chung
    lh.writeUInt16LE(0, 8) // method 0 = store
    lh.writeUInt16LE(0, 10) // giờ sửa (bỏ qua)
    lh.writeUInt16LE(0, 12) // ngày sửa (bỏ qua)
    lh.writeUInt32LE(crc, 14)
    lh.writeUInt32LE(size, 18) // kích thước nén = gốc (store)
    lh.writeUInt32LE(size, 22)
    lh.writeUInt16LE(nameBytes.length, 26)
    lh.writeUInt16LE(0, 28) // extra length
    locals.push(Buffer.concat([lh, nameBytes, data]))

    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0) // chữ ký central directory
    cd.writeUInt16LE(20, 4) // version tạo bởi
    cd.writeUInt16LE(20, 6) // version cần
    cd.writeUInt16LE(0, 8)
    cd.writeUInt16LE(0, 10)
    cd.writeUInt16LE(0, 12)
    cd.writeUInt16LE(0, 14)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(size, 20)
    cd.writeUInt32LE(size, 24)
    cd.writeUInt16LE(nameBytes.length, 28)
    cd.writeUInt16LE(0, 30) // extra
    cd.writeUInt16LE(0, 32) // comment
    cd.writeUInt16LE(0, 34) // disk số
    cd.writeUInt16LE(0, 36) // thuộc tính nội bộ
    cd.writeUInt32LE(0, 38) // thuộc tính ngoài
    cd.writeUInt32LE(offset, 42) // offset của local header
    centrals.push(Buffer.concat([cd, nameBytes]))

    offset += locals[locals.length - 1]!.length
  }

  const localData = Buffer.concat(locals)
  const centralDir = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0) // end of central directory
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralDir.length, 12)
  eocd.writeUInt32LE(localData.length, 16)
  eocd.writeUInt16LE(0, 20) // comment length

  return Buffer.concat([localData, centralDir, eocd])
}
