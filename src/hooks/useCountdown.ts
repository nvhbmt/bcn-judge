import { useEffect, useRef, useState } from 'react'

/**
 * Đếm ngược neo vào ĐỒNG HỒ SERVER (FR-I3, design §4.3).
 *
 * Máy người dùng lệch giờ là chuyện thường; nếu đếm ngược tin đồng hồ máy thì
 * contest "mở" sai lúc với mỗi người. Ta đo độ lệch một lần khi nhận `serverTime`
 * rồi áp cho mọi tick sau đó.
 */
export function useCountdown(
  targetIso: string | null,
  serverTimeIso: string | null,
  onReach?: () => void,
): string | null {
  const [text, setText] = useState<string | null>(null)
  const skewRef = useRef(0)
  const firedRef = useRef(false)

  useEffect(() => {
    if (serverTimeIso) skewRef.current = new Date(serverTimeIso).getTime() - Date.now()
  }, [serverTimeIso])

  useEffect(() => {
    if (!targetIso) {
      setText(null)
      return
    }
    firedRef.current = false
    const target = new Date(targetIso).getTime()

    const tick = () => {
      const remaining = target - (Date.now() + skewRef.current)
      if (remaining <= 0) {
        setText(null)
        if (!firedRef.current) {
          firedRef.current = true
          onReach?.()
        }
        return
      }
      setText(format(remaining))
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
    // onReach cố tình không nằm trong deps: nó là callback refetch, đổi mỗi render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIso])

  return text
}

function format(ms: number): string {
  const total = Math.floor(ms / 1000)
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total % 86_400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (days > 0) return `${days} ngày ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}
