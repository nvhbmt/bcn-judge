/**
 * Trang tài khoản — nơi gắn / bỏ gắn Discord, và là chỗ báo kết quả của luồng OAuth.
 *
 * Vì sao cần một TRANG chứ không nhét vào menu: callback Discord là một cú điều
 * hướng của trình duyệt, nó phải hạ cánh ở đâu đó có chỗ nói "đã gắn" hay "Discord
 * này đã thuộc người khác". Menu thả xuống không có chỗ đó — bấm gắn rồi quay về
 * trang chủ trắng trơn thì hỏng cũng như thành công đều im lặng y nhau.
 */
import { useMutation } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui'
import { api, ApiFailure } from '@/lib/api'
import { DISCORD_REASON, discordOk } from '@/lib/discord'
import { useAuth } from '@/stores/auth'

const ROLE_LABEL: Record<string, string> = { admin: 'Quản trị viên', mentor: 'Mentor', member: 'Học viên' }

export function AccountPage() {
  const { me, bootstrap } = useAuth()
  const [params, setParams] = useSearchParams()
  const reason = params.get('discord') ?? ''

  const unlink = useMutation({
    mutationFn: () => api.post('/auth/discord/unlink'),
    onSuccess: async () => {
      // Đọc lại /auth/me chứ không tự sửa state: trạng thái gắn là của server.
      await bootstrap()
      setParams({}, { replace: true })
    },
  })

  if (!me) return null

  return (
    <PageContainer>
      <h1 className="mb-1 font-display text-[24px] text-ink-1">Tài khoản</h1>
      <p className="mb-7 text-[14px] text-ink-5">Thông tin đăng nhập và cách vào hệ thống.</p>

      {reason && DISCORD_REASON[reason] ? (
        <p
          role="status"
          className={`mb-6 border-l-2 px-3 py-2 text-[13px] text-ink-3 ${
            discordOk(reason) ? 'border-moss bg-[var(--primary-soft)]' : 'border-clay bg-[var(--tint-clay)]'
          }`}
        >
          {DISCORD_REASON[reason]}
        </p>
      ) : null}

      <dl className="mb-8 border border-line bg-surface-2">
        <Field label="Tên hiển thị" value={me.displayName} />
        <Field label="Email" value={me.email} />
        <Field label="Vai trò" value={ROLE_LABEL[me.role] ?? me.role} />
      </dl>

      <h2 className="mb-1 font-mono text-[11px] tracking-[0.1em] text-ink-5 uppercase">Discord</h2>
      <p className="mb-3 text-[13px] leading-[1.6] text-ink-5">
        Gắn Discord để lần sau đăng nhập bằng một cú bấm, không phải gõ mật khẩu. Gắn hay bỏ gắn đều
        không đổi vai trò, khoá học hay team của bạn.
      </p>

      <div className="mb-8 flex flex-wrap items-center gap-3 border border-line bg-surface-2 px-4 py-3.5">
        {me.discordUsername ? (
          <>
            <span className="font-mono text-[13px] text-ink-2">
              Đang gắn: <span className="text-moss">{me.discordUsername}</span>
            </span>
            <Button
              className="ml-auto"
              size="sm"
              disabled={unlink.isPending}
              onClick={() => unlink.mutate()}
            >
              {unlink.isPending ? 'Đang bỏ gắn…' : 'Bỏ gắn'}
            </Button>
          </>
        ) : (
          <>
            <span className="font-mono text-[13px] text-ink-5">Chưa gắn tài khoản Discord nào.</span>
            {/* <a> chứ không <Link>: đây là điều hướng rời khỏi SPA sang discord.com. */}
            <a
              href="/auth/discord?intent=link"
              className="ml-auto border border-line-strong px-3 py-1.5 font-mono text-[13px] text-ink-2 transition-colors duration-[120ms] ease-linear hover:border-moss hover:text-ink-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
            >
              Gắn Discord
            </a>
          </>
        )}
      </div>

      {unlink.error ? (
        <p role="alert" className="mb-6 border-l-2 border-clay bg-[var(--tint-clay)] px-3 py-2 text-[13px] text-ink-3">
          {unlink.error instanceof ApiFailure ? unlink.error.error.message : 'Không bỏ gắn được.'}
        </p>
      ) : null}

      <h2 className="mb-1 font-mono text-[11px] tracking-[0.1em] text-ink-5 uppercase">Mật khẩu</h2>
      <p className="mb-3 text-[13px] text-ink-5">Đổi mật khẩu sẽ đăng xuất mọi thiết bị khác.</p>
      <Link to="/doi-mat-khau" className="inline-block">
        <Button>Đổi mật khẩu</Button>
      </Link>
    </PageContainer>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-4 border-b border-line px-4 py-2.5 last:border-b-0">
      <dt className="min-w-[8rem] font-mono text-[12px] text-ink-6">{label}</dt>
      <dd className="font-mono text-[13px] text-ink-2">{value}</dd>
    </div>
  )
}
