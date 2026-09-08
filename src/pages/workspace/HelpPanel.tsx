import { VerdictBadge } from "@/components/ui";
import { VERDICT_LABEL, type Verdict } from "@/types/api";

/** FR-E11: trang trợ giúp tiếng Việt ngay trong workspace. */
export function HelpPanel({ role }: { role: "admin" | "mentor" | "member" }) {
  return (
    <div className="space-y-5 px-4 py-4 text-sm">
      <section>
        <h2 className="mb-1 font-display text-[16px] text-ink-1">
          Làm bài thế nào?
        </h2>
        <ol className="list-decimal space-y-1 pl-5 text-ink-3">
          <li>Đọc đề ở khung giữa, chọn ngôn ngữ ở khung code bên phải.</li>
          <li>
            Bấm <b>Chạy thử</b> để chạy với testcase mẫu hoặc input tự nhập —
            không tính là nộp bài.
          </li>
          <li>
            Bấm <b>Nộp bài</b> để chấm trên toàn bộ testcase, kể cả testcase ẩn.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-1 font-display text-[16px] text-ink-1">
          Ý nghĩa các verdict
        </h2>
        {/* Tag ở đây dùng ĐÚNG công thức màu của chip testcase (`tone="soft"`: chữ và
            viền --verdict-x, nền --verdict-x-soft), không phải một bảng màu riêng cho
            trang trợ giúp. Bảng chú giải mà tô khác chỗ thật thì nó chú giải cho chính
            nó chứ không cho cái người ta vừa nhìn thấy — người đọc phải bắc cầu bằng
            chữ, mà màu mới là thứ họ nhớ. Đổi màu verdict ở token là cả hai đổi theo. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-96 border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] tracking-widest text-(--label) uppercase">
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Verdict
                </th>
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Mã
                </th>
                <th scope="col" className="py-1.5 font-medium">
                  Ý nghĩa
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {(Object.keys(VERDICT_LABEL) as Verdict[]).map((v) => (
                <tr key={v}>
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    <VerdictBadge verdict={v} tone="soft" />
                  </td>
                  {/* Mã gốc có CỘT RIÊNG chứ không nấp trong tooltip như mọi nơi khác:
                      đây đúng là chỗ người ta tra "TLE là gì", mà tooltip thì phải biết
                      trước là có cái để rê chuột vào mới thấy. */}
                  <td className="num py-1.5 pr-3 font-mono text-[12px] text-ink-5">
                    {v}
                  </td>
                  <td className="py-1.5 text-ink-3">{VERDICT_EXPLAIN[v]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] text-ink-4">
          Điểm một bài nộp là tỉ lệ trọng số testcase đúng, thang 0–100. Điểm tích luỹ vào tiến độ và bảng xếp
          hạng bằng tỉ lệ đó nhân với <strong>điểm tối đa của bài theo độ khó</strong> (ghi ngay dưới tên bài;
          admin đặt ở Cài đặt). Bảng xếp hạng xếp theo tổng điểm, hoà thì số bài AC, rồi ai đạt sớm hơn.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-display text-[16px] text-ink-1">
          Đọc dữ liệu vào, ghi dữ liệu ra
        </h2>
        <p className="text-ink-3">
          Chương trình đọc từ <b>stdin</b> và in ra <b>stdout</b> — không
          đọc/ghi file. Kết quả so sánh bỏ qua khoảng trắng cuối dòng và dòng
          trống cuối, nên thừa một dấu xuống dòng không bị tính sai.
        </p>
        <pre className="mt-2 overflow-x-auto bg-surface-1 p-2 font-mono text-xs">
          {`C:      scanf("%d %d", &a, &b);   printf("%d\\n", a + b);
C++:    std::cin >> a >> b;       std::cout << a + b << "\\n";
Python: a, b = map(int, input().split());  print(a + b)`}
        </pre>
      </section>

      <section>
        <h2 className="mb-1 font-display text-[16px] text-ink-1">Phím tắt</h2>
        <ul className="list-disc space-y-1 pl-5 text-ink-3">
          <li>
            <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> — chạy thử
          </li>
          <li>
            <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd> —
            nộp bài
          </li>
          <li>
            <kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd> — thụt lề; nhấn{" "}
            <kbd>Esc</kbd> trước rồi <kbd>Tab</kbd> để rời khỏi ô soạn code
          </li>
        </ul>
      </section>

      {role !== "member" ? (
        <section>
          <h2 className="mb-1 font-display text-[16px] text-ink-1">
            Dành cho mentor
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-ink-3">
            <li>
              Tải testcase hàng loạt bằng file zip theo quy ước{" "}
              <code>01.in</code> / <code>01.out</code>.
            </li>
            <li>
              Luôn bấm <b>Kiểm tra bằng lời giải mẫu</b> trước khi xuất bản — hệ
              thống báo đúng testcase nào lệch.
            </li>
            <li>
              Đề của contest chưa mở không được đặt nội dung quyết định chỉ
              trong ảnh: ảnh phục vụ theo id nên không chặn theo khung giờ được.
            </li>
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const VERDICT_EXPLAIN: Record<Verdict, string> = {
  AC: "Đúng toàn bộ testcase.",
  WA: "Chạy xong nhưng output không khớp đáp án.",
  TLE: "Chạy quá giới hạn thời gian của bài.",
  MLE: "Dùng quá giới hạn bộ nhớ.",
  RE: "Chương trình dừng bất thường (chia 0, tràn mảng, thoát khác 0…).",
  CE: "Không biên dịch được — xem thông báo của trình biên dịch.",
  IE: "Lỗi phía hệ thống chấm, không phải lỗi của bạn; bài sẽ được chấm lại.",
};
