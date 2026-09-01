/** Chuyển đổi giữa ISO (API) và giá trị `<input type="datetime-local">`. */

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * ISO → `YYYY-MM-DDTHH:mm` theo GIỜ ĐỊA PHƯƠNG. Không dùng
 * `toISOString().slice(0, 16)`: nó trả giờ UTC, vào ô datetime-local sẽ lệch
 * đúng bằng chênh múi giờ (VN +7) — contest 20:00 hiện thành 13:00.
 */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * `YYYY-MM-DDTHH:mm` → ISO kèm `Z` (zod `.datetime()` phía server chỉ nhận dạng
 * này). Chuỗi datetime-local không mang offset nên ES spec đọc theo giờ địa
 * phương — đúng thứ người nhập đang nghĩ.
 */
export function localInputToIso(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
