/**
 * Màn 01 của bản v2: bảng log + logo lớn bên trái, form bên phải trên nền cao một bậc.
 *
 * Ô nhập chỉ có GẠCH CHÂN, không phải hộp có viền bốn cạnh — đây là điểm khác rõ
 * nhất với form thường và là chủ ý của thiết kế: dòng nhập trông như một dòng lệnh
 * đang gõ dở, không như một biểu mẫu hành chính. Dấu nhắc `>` đứng trước cũng vậy.
 *
 * Con mắt bật/tắt mật khẩu có vì người ta gõ mật khẩu admin cấp (10 ký tự ngẫu
 * nhiên) trên bàn phím laptop lúc 11 giờ đêm.
 */
import { useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { PasswordEye } from "@/components/ui";
import { DISCORD_REASON } from "@/lib/discord";
import { useAuth } from "@/stores/auth";
import { DiscordLogin } from "./login/DiscordLogin";
import { SystemLog } from "./login/SystemLog";

function PromptInput({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  trailing,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-7">
      <label
        className="mb-2 block font-mono text-[11px] tracking-[0.1em] text-ink-5 uppercase"
        htmlFor={id}
      >
        {label}
      </label>
      {/* Gạch chân, không phải hộp. `focus-within` chứ không `:focus-visible`: vòng
          sáng thuộc về cả dòng (dấu nhắc + ô + nút hiện), và với ô văn bản thì hiện
          vòng sáng cả khi bấm chuột là đúng — khác nút bấm. */}
      <div className="flex items-center gap-2.5 border-b border-line-strong pb-2.5 focus-within:border-moss">
        <span aria-hidden className="font-mono text-[15px] text-moss">
          &gt;
        </span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className="w-full bg-transparent font-mono text-[15px] text-ink-1 outline-none"
        />
        {trailing}
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login, error } = useAuth();
  // Callback Discord hỏng thì đá về đây kèm `?discord=<mã>`; không dịch mã ra chữ
  // thì người dùng chỉ thấy mình quay lại chỗ cũ mà không hiểu vì sao.
  const [params] = useSearchParams();
  const discordLoi = DISCORD_REASON[params.get("discord") ?? ""];
  const [emailOrUsername, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await login(emailOrUsername, password);
    setBusy(false);
  }

  return (
    <div className="grid h-full md:grid-cols-[minmax(0,1fr)_480px]">
      <div className="hidden md:block">
        <SystemLog />
      </div>

      <div className="flex flex-col justify-center bg-surface-1 px-12 py-14">
        <form onSubmit={onSubmit} className="w-full">
          <p className="mb-2.5 font-mono text-[11px] tracking-[0.14em] text-ink-6 uppercase">
            Đăng nhập
          </p>
          <h1 className="mb-2 font-display text-[26px] text-ink-1">
            Xin chào, coder.
          </h1>
          <p className="mb-9 text-[14px] leading-[1.6] text-ink-4">
            Chưa có tài khoản? Liên hệ ngay các mentor để được cấp tài khoản.
          </p>

          <PromptInput
            id="email"
            label="Email hoặc username"
            value={emailOrUsername}
            onChange={setEmail}
            autoComplete="username"
          />
          <PromptInput
            id="password"
            label="Mật khẩu"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            trailing={
              <span className="ml-auto">
                <PasswordEye
                  shown={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                />
              </span>
            }
          />

          {discordLoi ? (
            <p
              role="alert"
              className="mb-5 border-l-2 border-clay bg-[var(--tint-clay)] px-3 py-2 text-[13px] text-ink-3"
            >
              {discordLoi}
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mb-5 border-l-2 border-clay bg-[var(--tint-clay)] px-3 py-2 text-[13px] text-ink-3"
            >
              {error}
            </p>
          ) : null}

          {/* Không dùng <Button>: nút này là khối đặc cao 52px riêng của màn đăng nhập,
              có ký tự ↵ nói phím Enter cũng gửi được — không phải nút cỡ chuẩn. */}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2.5 bg-[var(--moss-solid,var(--moss))] px-4 py-4 font-mono text-[14px] font-semibold tracking-[0.04em] text-on-accent uppercase transition-opacity duration-[120ms] ease-linear hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-5"
          >
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
            {busy ? null : (
              <span aria-hidden className="opacity-55">
                ↵
              </span>
            )}
          </button>

          <DiscordLogin />
        </form>
      </div>
    </div>
  );
}
