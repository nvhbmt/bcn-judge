/**
 * Khối "Quét Discord" trên trang Tình trạng chấm — kết quả lượt quét gần nhất của bộ
 * khoá-khi-rời-server (server/src/auth/discordSweep.ts).
 *
 * Ba trạng thái nói ba chuyện khác nhau, không gộp: TẮT (thiếu cấu hình — admin cần
 * biết là chưa bật, không phải "chưa có gì"), CHƯA CÓ LƯỢT (bật rồi nhưng chưa tới
 * giờ), và CÓ KẾT QUẢ (kể cả lượt bị bỏ — bỏ vì sao là thứ admin phải thấy, nếu không
 * bộ quét hỏng suốt tháng mà bảng vẫn xanh).
 */
import { SectionRule } from '@/components/ui'
import { cn } from '@/lib/cn'

export interface DiscordSweepStatus {
  enabled: boolean
  last: {
    at: string
    checked: number
    locked: number
    skipped: 'discord_loi' | 'danh_sach_rong' | 'qua_nua' | 'dang_chay_noi_khac' | null
  } | null
}

const SKIPPED: Record<string, string> = {
  discord_loi: 'Không hỏi được Discord (mạng, token bot sai, hoặc chưa bật Server Members Intent).',
  danh_sach_rong: 'Discord trả danh sách rỗng — coi là lỗi, không khoá ai.',
  qua_nua: 'Định khoá quá nửa số tài khoản trong một lượt — huỷ vì nghi danh sách thiếu.',
  dang_chay_noi_khac: 'Một bản API khác đang quét.',
}

export function DiscordSweepCard({ status }: { status: DiscordSweepStatus | undefined }) {
  if (!status) return null
  const last = status.last
  return (
    <section className="mt-8">
      <SectionRule
        label="Quét Discord"
        meta={status.enabled ? (last ? new Date(last.at).toLocaleString('vi-VN') : 'chưa có lượt nào') : 'tắt'}
      />
      <p className="mt-3 text-[13px] text-ink-5">
        Ai rời server Discord của ban thì tài khoản do cổng Discord sinh ra bị khoá; vào lại server rồi đăng nhập bằng
        Discord là mở lại.
      </p>
      {!status.enabled ? (
        <p className="mt-2 font-mono text-[12px] text-ink-5">
          Bật bằng <code>DISCORD_GUILD_ID</code> + <code>DISCORD_BOT_TOKEN</code> trong .env.api.
        </p>
      ) : last ? (
        <p className={cn('num mt-2 font-mono text-[12px]', last.skipped ? 'text-clay' : 'text-ink-3')}>
          {last.skipped
            ? `Bỏ lượt: ${SKIPPED[last.skipped] ?? last.skipped}`
            : `${last.checked} tài khoản đã đối chiếu · khoá ${last.locked}`}
        </p>
      ) : null}
    </section>
  )
}
