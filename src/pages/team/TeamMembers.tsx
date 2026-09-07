/**
 * Danh sách thành viên của team — MỘT dòng mỗi người, bấm vào mới mở chi tiết.
 *
 * Bản trước đổ hết ra cùng lúc: một dải chip tên (bấm không làm gì), rồi bảng tiến độ
 * MỘT DÒNG MỖI CẶP (người × khoá) — 6 người 2 khoá thành 12 dòng với tên lặp lại sáu
 * lần — rồi mới tới câu "bấm tên một thành viên ở bảng trên" nằm tận đáy trang. Thứ
 * duy nhất bấm được lại trông giống chữ thường nhất.
 *
 * Nay: một dòng một người, gộp mọi khoá lại thành một con số; bấm vào thì sang TRANG
 * RIÊNG của người đó (TeamMemberPage). Leader lướt cả nhóm trước, đào sâu sau — đúng
 * thứ tự họ làm.
 *
 * Vì sao trang riêng chứ không mở tại chỗ: một thành viên chăm chỉ có vài chục lượt
 * nộp kèm mã nguồn, mở ra là khối cao hơn 6000px đẩy những người còn lại khỏi màn
 * hình — lại thành "đổ hết ra", chỉ lùi xuống một tầng.
 *
 * Danh sách dựng từ `team.members` chứ KHÔNG từ dữ liệu tiến độ: endpoint tiến độ chỉ
 * trả người đã ghi danh một khoá đang mở, nên người chưa ghi danh biến mất khỏi bảng
 * cũ — đúng những người leader cần nhìn thấy nhất. Giờ họ vẫn có dòng, ghi rõ "chưa
 * ghi danh khoá nào".
 */
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Spinner } from "@/components/ui";
import { Avatar } from "@/components/ui/patterns";
import { api } from "@/lib/api";
import type { TeamProgressRow, TeamView } from "./types";
import { cn } from "@/lib/cn";

const ngay = (iso: string) =>
  new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });

export function TeamMembers({ team }: { team: TeamView }) {
  // Chỉ leader mới đọc được endpoint này (server chặn 403), nên người thường không gọi.
  const { data: progress, isLoading } = useQuery({
    queryKey: ["team", team.id, "progress"],
    queryFn: () =>
      api.get<TeamProgressRow[]>(`/api/member/teams/${team.id}/progress`),
    enabled: team.isLeader,
  });

  if (team.isLeader && isLoading) return <Spinner />;

  return (
    <ul className="flex flex-col gap-px bg-line">
      {team.members.map((m) => {
        const cua = progress?.filter((r) => r.userId === m.id) ?? [];
        const ac = cua.reduce((s, r) => s + r.acCount, 0);
        const tong = cua.reduce((s, r) => s + r.totalItems, 0);
        const nopCuoi = cua.reduce<string | null>(
          (max, r) =>
            r.lastSubmittedAt && (!max || r.lastSubmittedAt > max)
              ? r.lastSubmittedAt
              : max,
          null,
        );

        const than = (
          <>
            <Avatar name={m.displayName} size={26} src={m.avatarUrl} />
            <span className="min-w-0 flex-1 truncate text-left text-[15px] text-ink-2">
              {m.displayName}
            </span>
            {m.isLeader ? (
              <span className="shrink-0 font-mono text-[10px] tracking-[0.06em] text-brass uppercase">
                leader
              </span>
            ) : null}

            {team.isLeader ? (
              <>
                {/* Chưa ghi danh khoá nào là TIN, không phải ô trống: đó đúng là
                    người leader cần đi hỏi trước tiên. */}
                <span className="num w-32 shrink-0 text-right font-mono text-[13px] text-ink-4">
                  {cua.length > 0 ? (
                    `${ac}/${tong} bài`
                  ) : (
                    <span className="text-earth">chưa ghi danh</span>
                  )}
                </span>
                <span
                  className={cn(
                    "num w-16 shrink-0 text-right font-mono text-[13px]",
                    nopCuoi ? "text-ink-6" : "text-earth",
                  )}
                >
                  {nopCuoi ? ngay(nopCuoi) : cua.length > 0 ? "chưa nộp" : ""}
                </span>
                <ChevronRight
                  size={14}
                  aria-hidden
                  className="shrink-0 text-ink-6"
                />
              </>
            ) : null}
          </>
        );

        return (
          <li key={m.id} className="bg-surface-2">
            {team.isLeader ? (
              <Link
                to={`/team/thanh-vien/${m.id}`}
                className="flex w-full items-center gap-3 px-4 py-2.5 no-underline transition-colors duration-120 ease-linear hover:bg-surface-sel focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-moss"
              >
                {than}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-4 py-2.5">{than}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
