/**
 * Bảng log cạnh form đăng nhập (màn 01 của bản v2).
 *
 * Mỗi dòng ở đây phải NÓI THẬT. Bản thiết kế vẽ sẵn "4 worker · 16 slot · hàng đợi
 * rỗng", nhưng những số đó chỉ đọc được qua `/api/admin/judge` — tức là phải đăng
 * nhập bằng quyền admin mới có. Vẽ số cứng lên màn đăng nhập là bịa dữ liệu vận
 * hành, nên ở đây chỉ giữ hai loại dòng:
 *   - sự thật tĩnh về cấu hình sandbox (đúng bất kể máy chủ ra sao)
 *   - một dòng ĐỘNG lấy từ `/healthz`, endpoint công khai duy nhất
 */
import { useEffect, useState } from 'react'

type Health = 'checking' | 'up' | 'down'

const STATIC_LINES = [
  'runner c11 · cpp17 · python3 · java17 · node20',
  'sandbox không mạng · container riêng mỗi bài nộp',
  'testcase ẩn không bao giờ rời máy chủ',
]

function Line({ state, children }: { state: 'ok' | 'wait' | 'fail'; children: string }) {
  const mark = state === 'ok' ? '[ok]' : state === 'wait' ? '[..]' : '[!!]'
  const color =
    state === 'ok' ? 'text-moss' : state === 'wait' ? 'text-ink-6' : 'text-clay'
  return (
    <p className="flex gap-3 font-mono text-[11px] leading-[1.9]">
      <span className={`${color} shrink-0`}>{mark}</span>
      <span className="text-ink-5">{children}</span>
    </p>
  )
}

export function SystemLog() {
  const [health, setHealth] = useState<Health>('checking')

  useEffect(() => {
    let alive = true
    fetch('/healthz')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('down'))))
      .then((body) => alive && setHealth(body?.data?.status === 'ok' || body?.status === 'ok' ? 'up' : 'down'))
      .catch(() => alive && setHealth('down'))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="flex h-full flex-col justify-center gap-1 border-line px-8 py-10 md:border-r">
      <p className="mb-3 font-mono text-[11px] tracking-[0.14em] text-ink-6 uppercase">
        judge.bancongnghe.dev
      </p>

      {STATIC_LINES.map((line) => (
        <Line key={line} state="ok">
          {line}
        </Line>
      ))}

      <Line state={health === 'up' ? 'ok' : health === 'down' ? 'fail' : 'wait'}>
        {health === 'up'
          ? 'máy chủ và database đang chạy'
          : health === 'down'
            ? 'không gọi được máy chủ — báo mentor'
            : 'đang kiểm tra máy chủ…'}
      </Line>

      <Line state="wait">chờ bạn đăng nhập</Line>

      {/* Con trỏ nhấp nháy — ngoại lệ chuyển động duy nhất của hệ thiết kế. */}
      <p aria-hidden className="mt-1 font-mono text-[13px] text-moss">
        <span className="animate-[blink_1s_steps(1,end)_infinite]">_</span>
      </p>

      <p className="mt-6 font-mono text-[10px] text-ink-6">
        chấm tự động cho câu lạc bộ Ban Công Nghệ
      </p>
    </div>
  )
}
