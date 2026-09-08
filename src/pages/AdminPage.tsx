/**
 * Màn 08 của bản v2 — tình trạng chấm bài (FR-H3).
 *
 * Chỉ là PHẦN THÂN: khung, tiêu đề và thanh điều hướng do `AdminShell` lo, giống hệt
 * bốn trang quản trị còn lại. Trước đây trang này tự dựng khung riêng, nên chuyển sang
 * nó là cả cụm quản trị trượt ngang một nấc — bốn trang `max-w-5xl px-4`, riêng nó
 * `max-w-5xl px-7` với thanh nav bọc trong `max-w-3xl`.
 *
 * Bản vẽ đặt "tình trạng chấm" và "tài khoản" cạnh nhau trên một màn. Ở đây hai cụm
 * đó là hai route riêng (`/quan-tri` và `/quan-tri/tai-khoan`) và giữ nguyên như vậy:
 * gộp lại thành một trang là bắt admin cuộn qua bảng tài khoản mỗi lần chỉ muốn liếc
 * hàng đợi, mà liếc hàng đợi mới là việc họ làm hàng ngày. Ngôn ngữ trình bày thì theo
 * đúng bản vẽ: dải bốn số, danh sách worker dạng nhóm dòng, băng cảnh báo có vạch trái.
 */
import { Button, EmptyState, SectionRule, Spinner } from "@/components/ui";
import { Row, RowGroup, StatStrip } from "@/components/ui/patterns";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from '@/lib/cn'
import { DiscordSweepCard, type DiscordSweepStatus } from "./admin/DiscordSweepCard";

interface JudgeStatus {
  queue: {
    pendingSubmit: number;
    pendingRun: number;
    running: number;
    oldestPendingSubmitSec: number | null;
  };
  workers: {
    id: string;
    slots: number;
    alive: boolean;
    lastSeenAt: string;
    running: number;
    silentSec: number;
  }[];
  ieSubmissions: { id: string; ieReason: string | null; receivedAt: string }[];
  judgePaused: boolean;
  discordSweep?: DiscordSweepStatus;
  health: {
    submitBacklogAlarm: boolean;
    runBacklogWarning: boolean;
    noLiveWorker: boolean;
  };
}

/**
 * Băng cảnh báo. Hai mức tách bạch theo đúng nghĩa cố định của hai màu điểm: `clay`
 * là hỏng và phải xử lý ngay, `earth` là đáng chú ý nhưng chưa cần làm gì.
 */
function Banner({
  level,
  children,
}: {
  level: "alarm" | "warn";
  children: string;
}) {
  const alarm = level === "alarm";
  return (
    <p
      role={alarm ? "alert" : undefined}
      className={cn(
        'mb-3 border-l-2 px-3 py-2 text-[13px]',
        alarm ? "border-clay bg-(--tint-clay) text-ink-2" : "border-earth bg-(--tint-earth) text-ink-3",
      )}
    >
      {children}
      {alarm ? null : (
        <span className="mt-0.5 block font-mono text-[11px] text-ink-5">
          cảnh báo, chưa cần xử lý
        </span>
      )}
    </p>
  );
}

/** "14 phút" dễ đọc hơn "847 giây" khi cần biết worker chết bao lâu rồi. */
function phut(sec: number): string {
  if (sec < 90) return `${Math.round(sec)} giây`;
  const m = Math.round(sec / 60);
  return m < 90 ? `${m} phút` : `${Math.round(m / 60)} giờ`;
}

export function AdminPage() {
  const client = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "judge"],
    queryFn: () => api.get<JudgeStatus>("/api/admin/judge"),
    refetchInterval: 5000,
  });
  const retryIe = useMutation({
    mutationFn: () =>
      api.post("/api/admin/judge/retry-ie", { withinHours: 24 }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "judge"] }),
  });
  const togglePause = useMutation({
    mutationFn: (paused: boolean) =>
      api.post("/api/admin/judge/pause", { paused }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "judge"] }),
  });

  if (isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  if (!data) return <EmptyState title="Không đọc được tình trạng chấm" />;

  const cho = data.queue.oldestPendingSubmitSec;
  return (
    <>
      {data.health.noLiveWorker ? (
        <Banner level="alarm">
          Không có worker nào sống — bài nộp đang xếp hàng.
        </Banner>
      ) : null}
      {data.health.submitBacklogAlarm ? (
        <Banner level="alarm">Bài nộp chờ quá 2 phút — kiểm tra worker.</Banner>
      ) : null}
      {data.health.runBacklogWarning ? (
        <Banner level="warn">
          Nhiều lượt chạy thử đang chờ — bình thường ở giờ đầu contest.
        </Banner>
      ) : null}

      <StatStrip
        items={[
          {
            label: "Nộp bài chờ",
            value: data.queue.pendingSubmit,
            tone: data.queue.pendingSubmit > 0 ? "earth" : undefined,
          },
          { label: "Chạy thử chờ", value: data.queue.pendingRun },
          // Chỉ tô màu khi con số CÓ nghĩa: 0 tô xanh trông như "đang tốt" trong khi nó chỉ
          // nghĩa là không có việc gì.
          {
            label: "Đang chấm",
            value: data.queue.running,
            tone: data.queue.running > 0 ? "moss" : undefined,
          },
          {
            label: "Chờ lâu nhất",
            value: cho === null ? "—" : `${Math.round(cho)}s`,
          },
        ]}
      />

      <section className="mt-8">
        <SectionRule
          label="Worker"
          meta={`${data.workers.filter((w) => w.alive).length}/${data.workers.length} sống`}
        />
        {data.workers.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-5">
            Chưa worker nào đăng ký.
          </p>
        ) : (
          <RowGroup className="mt-3">
            {data.workers.map((w) => (
              <Row key={w.id}>
                <span
                  aria-hidden
                  className={cn('size-2 shrink-0 rounded-full', w.alive ? "bg-moss-fill" : "bg-clay")}
                />
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-2">
                  {w.id}
                </span>
                <span className="num shrink-0 font-mono text-[11px] text-ink-5">
                  {w.alive ? (
                    <>
                      {w.slots} slot · {w.running} đang chạy
                    </>
                  ) : (
                    <span className="text-clay">
                      mất tín hiệu {phut(w.silentSec)}
                    </span>
                  )}
                </span>
                <span className="num shrink-0 font-mono text-[11px] text-ink-6">
                  {new Date(w.lastSeenAt).toLocaleTimeString("vi-VN")}
                </span>
              </Row>
            ))}
          </RowGroup>
        )}
      </section>

      <section className="mt-8">
        <SectionRule
          label="Bài lỗi hệ thống (IE) — 48 giờ qua"
          meta={`${data.ieSubmissions.length} bài`}
        />
        <p className="mt-3 mb-3 text-[13px] text-ink-5">
          IE không tính vào lượt của member và được chấm lại.
        </p>
        <Button
          onClick={() => retryIe.mutate()}
          disabled={retryIe.isPending || data.ieSubmissions.length === 0}
        >
          {retryIe.isPending
            ? "Đang xếp lại…"
            : "Chấm lại toàn bộ IE trong 24 giờ"}
        </Button>
      </section>

      <section className="mt-8">
        <SectionRule label="Bảo trì" />
        <p className="mt-3 mb-3 text-[13px] text-ink-5">
          Tạm dừng nhận bài nộp mới; member vẫn đọc đề và lưu nháp bình thường.
        </p>
        {/* Nút phá dữ liệu nói HẬU QUẢ ngay trên chính nó, không giấu trong hộp thoại. */}
        <Button
          variant={data.judgePaused ? "primary" : "danger"}
          onClick={() => togglePause.mutate(!data.judgePaused)}
          disabled={togglePause.isPending}
        >
          {data.judgePaused ? "Mở nhận bài trở lại" : "Tạm dừng nhận bài"}
        </Button>
      </section>

      <DiscordSweepCard status={data.discordSweep} />
    </>
  );
}
