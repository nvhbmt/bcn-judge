/**
 * Bảng xếp hạng contest — hạng · tên · số bài đã giải · điểm.
 *
 * BỎ một cột cho mỗi bài (bản trước có). Lý do là chỗ đứng: bảng này nằm trong
 * `SideColumn` hẹp của màn contest, nên 10 bài là 10 cột chen vào và cột tên bị bóp
 * còn "Phạ…". Đánh đổi đó sai hướng: "ai làm được bài nào" là thứ xem cho vui, còn
 * "người này là ai" là thứ không đọc được thì cả bảng vô nghĩa.
 *
 * `acCount` do máy chủ trả sẵn (contest/standings.ts) nên phân số "đã giải" không
 * tốn thêm phép tính nào ở client. Nó đếm bài có verdict AC — bài ăn điểm một phần
 * KHÔNG tính là giải xong, nhưng vẫn cộng vào cột điểm; hai con số cạnh nhau đọc ra
 * đúng chuyện đó.
 */
import { useQuery } from "@tanstack/react-query";
import { EmptyState, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { ContestStandingRow } from "./standings";
import { cn } from "@/lib/cn";
import { medal } from "@/lib/medal";

export function ContestStandings({
  contestId,
  problems,
}: {
  contestId: string;
  /** Chỉ cần SỐ LƯỢNG — đó là mẫu số của "đã giải x/n". */
  problems: { id: string; label: string | null }[];
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["contest", contestId, "standings"],
    queryFn: () =>
      api.get<ContestStandingRow[]>(
        `/api/member/contests/${contestId}/standings`,
      ),
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <Spinner />
      </div>
    );
  }
  if (!data || data.length === 0)
    return <EmptyState title="Chưa ai có kết quả" />;

  return (
    // table-fixed + colgroup: cùng lý do với TeamStandings — bỏ <thead> là mất
    // các w-9/w-[4.75rem]/w-14 từng sống trên <th>, cột tên co tịt.
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">Bảng xếp hạng contest</caption>
      <colgroup>
        <col className="w-9" />
        <col />
        {/* Đủ chỗ cho "10/10 bài" trên một dòng; rộng hơn nữa là lấn cột tên. */}
        <col className="w-22" />
        <col className="w-14" />
      </colgroup>
      {/* KHÔNG có <thead>: bản vẽ bỏ hàng tiêu đề cột để bảng trong cột phải chỉ còn
          dữ liệu. `<caption>` ở lại (sr-only) nên trình đọc màn hình vẫn biết đây là
          bảng gì — bỏ cả caption mới là mất thông tin thật.
          Cột "Đã giải" vì thế mang nhãn ngay trong ô ("1/4 bài", cùng kiểu nhãn phụ
          của bảng team và bục vinh danh), đừng dựng lại hàng tiêu đề. */}
      <tbody>
        {data.map((row) => (
          <tr
            key={row.userId}
            className={cn(
              "border-b border-line",
              row.isMe && "bg-primary-soft shadow-[inset_2px_0_0_var(--moss)]",
            )}
          >
            {/* Top-3 đeo huy chương như mọi bảng khác (lib/medal); `title` giữ con số
                cho ai cần đọc hạng chính xác, và cho trình đọc màn hình. */}
            <td
              title={`Hạng ${row.rank}`}
              className={cn(
                "num px-2.5 py-2.5 font-mono text-[14px]",
                row.isMe ? "text-moss" : "text-ink-5",
              )}
            >
              {medal(row.rank) ?? row.rank}
            </td>
            {/* `max-w-0` + `truncate` là cách cắt chữ trong ô bảng: không có nó thì
                tên dài đẩy bảng rộng ra thay vì thu gọn lại. `title` giữ tên đầy đủ
                cho tên vẫn dài quá chỗ. */}
            <td
              title={row.isMe ? undefined : row.displayName}
              className={cn(
                "max-w-0 truncate px-2.5 py-2.5 text-[15px]",
                row.isMe ? "font-semibold text-ink-1" : "text-ink-2",
              )}
            >
              {row.isMe ? "Bạn" : row.displayName}
            </td>
            <td className="num px-2.5 py-2.5 text-right font-mono text-[14px] whitespace-nowrap">
              {/* Mẫu số mờ hơn tử số: số bài giải được mới là thứ so giữa các hàng,
                  còn tổng số bài thì cả bảng giống nhau. */}
              <span className={row.acCount > 0 ? "text-ink-2" : "text-ink-5"}>
                {row.acCount}
              </span>
              <span className="text-ink-6">/{problems.length}</span>
              <span className="ml-1 text-[12px] text-ink-6">bài</span>
            </td>
            <td
              className={cn(
                "num px-2.5 py-2.5 text-right font-mono text-[14px]",
                row.isMe ? "text-ink-1" : "text-ink-4",
              )}
            >
              {Math.round(row.totalPoints)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
