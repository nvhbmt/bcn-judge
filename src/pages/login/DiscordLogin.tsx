/**
 * Nút "Đăng nhập bằng Discord" ở màn 01.
 *
 * Chỉ hiện khi server nói tính năng ĐANG BẬT (`GET /auth/providers`). Vẽ sẵn rồi để
 * người ta bấm vào một hệ chưa cấu hình là kiểu hỏng tệ nhất: họ bị đá về đúng màn
 * cũ, không có thông báo nào giải thích, và tưởng mình gõ sai gì đó.
 *
 * Dùng thẻ <a> chứ không <Link> của router: đây là điều hướng RỜI KHỎI SPA sang
 * discord.com, phải để trình duyệt tự đi. Router chỉ đổi URL trong bộ nhớ.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function DiscordLogin() {
  const { data } = useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: () => api.get<{ discord: boolean }>('/auth/providers'),
    // Cấu hình server không đổi giữa chừng một phiên làm việc.
    staleTime: Infinity,
    retry: false,
  })

  if (!data?.discord) return null

  return (
    <>
      <div className="my-7 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-[11px] tracking-[0.1em] text-[var(--label)] uppercase">hoặc</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <a
        href="/auth/discord"
        className="flex w-full items-center justify-center gap-2.5 border border-line-strong px-4 py-3.5 font-mono text-[14px] text-ink-2 transition-colors duration-[120ms] ease-linear hover:border-moss hover:text-ink-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
      >
        <DiscordMark />
        Đăng nhập bằng Discord
      </a>

      {/* Nói trước để khỏi bấm rồi mới biết: Discord không cấp tài khoản mới. */}
      <p className="mt-3 text-center font-mono text-[11px] leading-[1.6] text-ink-6">
        Dùng được sau khi tài khoản đã gắn Discord.
      </p>
    </>
  )
}

/** Logo Discord dạng SVG, tô bằng `currentColor` nên tự theo theme. */
function DiscordMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 18" width="18" height="14" fill="currentColor">
      <path d="M20.32 1.51A19.8 19.8 0 0 0 15.43 0c-.21.38-.46.9-.63 1.31a18.3 18.3 0 0 0-5.6 0C9.03.9 8.77.38 8.56 0a19.7 19.7 0 0 0-4.89 1.51C.57 6.09-.27 10.56.15 14.96A19.9 19.9 0 0 0 6.19 18c.49-.66.92-1.37 1.29-2.11-.71-.27-1.39-.6-2.03-.98.17-.13.34-.26.5-.4a14.2 14.2 0 0 0 12.1 0c.16.14.33.27.5.4-.64.38-1.32.71-2.03.98.37.74.8 1.45 1.29 2.11a19.9 19.9 0 0 0 6.04-3.04c.5-5.1-.84-9.53-3.53-13.45ZM8.02 12.27c-1.18 0-2.15-1.08-2.15-2.4 0-1.32.95-2.4 2.15-2.4 1.21 0 2.18 1.09 2.16 2.4 0 1.32-.95 2.4-2.16 2.4Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.4 0-1.32.95-2.4 2.15-2.4 1.21 0 2.18 1.09 2.16 2.4 0 1.32-.95 2.4-2.16 2.4Z" />
    </svg>
  )
}
