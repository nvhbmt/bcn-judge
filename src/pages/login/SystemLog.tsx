/**
 * Cột trái của màn đăng nhập (màn 01 của bản v2).
 *
 * Ba tầng theo bản vẽ, dàn bằng `justify-between`: dòng host ở đỉnh → logo lớn +
 * motif + bảng log ở giữa → dòng phiên bản ở đáy. Logo ở ĐÂY chứ không phải trên
 * form: nó là cái duy nhất trên màn này được phép to.
 *
 * Mỗi dòng log phải NÓI THẬT. Bản thiết kế vẽ sẵn "4 worker · 16 slot · hàng đợi
 * rỗng", nhưng những số đó chỉ đọc được qua `/api/admin/judge` — tức là phải đăng
 * nhập bằng quyền admin mới có. Vẽ số cứng lên màn đăng nhập là bịa dữ liệu vận
 * hành, nên ở đây chỉ giữ hai loại dòng:
 *   - sự thật tĩnh về cấu hình sandbox (đúng bất kể máy chủ ra sao)
 *   - một dòng ĐỘNG lấy từ `/healthz`, endpoint công khai duy nhất
 */
import { useEffect, useState } from 'react'
import { BcnLogo } from '@/components/BcnLogo'
import { cn } from '@/lib/cn'

type Health = 'checking' | 'up' | 'down'

const STATIC_LINES = [
  'runner c11 · cpp17 · python3 · java17 · node20',
  'sandbox không mạng · container riêng mỗi bài nộp',
  'testcase ẩn không bao giờ rời máy chủ',
]

function Line({ state, children }: { state: 'ok' | 'wait' | 'fail'; children: string }) {
  const mark = state === 'ok' ? '[ok]' : state === 'wait' ? '[..]' : '[!!]'
  const color = state === 'ok' ? 'text-ink-5' : state === 'wait' ? 'text-moss' : 'text-clay'
  return (
    <p className={cn('font-mono text-[13px] leading-loose', state === 'wait' ? 'text-moss' : 'text-ink-5')}>
      <span className={color}>{mark}</span>
      {'  '}
      {children}
      {/* Con trỏ nhấp nháy — ngoại lệ chuyển động DUY NHẤT của hệ thiết kế. */}
      {state === 'wait' ? <span className="animate-[blink_1s_steps(1,end)_infinite]">_</span> : null}
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
    <div className="flex h-full flex-col justify-between overflow-hidden border-line px-14 py-12 md:border-r">
      <p className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.14em] text-(--label) uppercase">
        <span aria-hidden className="size-1.75 rounded-full bg-moss-fill" />
        judge.bancongnghe.dev
      </p>

      <div className="flex min-h-0 max-w-155 flex-col gap-9">
        <BcnLogo className="w-full text-ink-1" />

        <div className="flex flex-col gap-3.5">
          {/* Motif nhận diện, bản dài: đường kẻ chạy hết chiều ngang, khối đặc ở cuối. */}
          <div aria-hidden className="flex items-end">
            <div className="h-px flex-1 bg-line-strong" />
            <div className="h-2.25 w-6.5 bg-moss-fill" />
          </div>

          <div>
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
          </div>
        </div>
      </div>

      <p className="font-mono text-[11px] text-ink-5">hệ thống code judge dành cho Ban Công Nghệ</p>
    </div>
  )
}
