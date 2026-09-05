/**
 * Ô nhập mã khoá để tự ghi danh (FR-B4).
 *
 * Cờ `self_enroll` đã có ở schema, ở API quản trị và ở form của admin từ lâu, nhưng
 * không có đường nào cho member dùng — bật cờ lên rồi thì vẫn phải nhờ mentor ghi
 * danh tay. Đây là nửa còn lại.
 *
 * Chỉ hiện với member: mentor và admin ghi danh cho người khác qua cụm quản trị, còn
 * chính họ thì không "tham gia" khoá mình dạy (họ nằm ở `course_mentors`).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { ApiFailure } from "@/lib/api";

export function JoinByCode({ role }: { role: string }) {
  const client = useQueryClient();
  const [code, setCode] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const [xong, setXong] = useState<string | null>(null);

  const thamGia = useMutation({
    mutationFn: (ma: string) =>
      api.post<{ name: string }>("/api/member/courses/tham-gia", { code: ma }),
    onSuccess: (data) => {
      setLoi(null);
      setCode("");
      setXong(`Đã vào khoá “${data.name}”.`);
      void client.invalidateQueries({ queryKey: ["member", "courses"] });
    },
    onError: (err) => {
      setXong(null);
      setLoi(
        err instanceof ApiFailure
          ? err.error.message
          : "Không tham gia được, thử lại sau.",
      );
    },
  });

  if (role !== "member") return null;

  return (
    <form
      className="mt-4 border border-line bg-surface-2 px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) thamGia.mutate(code.trim());
      }}
    >
      <label
        htmlFor="ma-khoa"
        className="mb-2 block font-mono text-[12px] tracking-[0.14em] text-(--label) uppercase"
      >
        Vào khoá bằng mã
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="ma-khoa"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setLoi(null);
            setXong(null);
          }}
          placeholder="VD: CS101"
          // Mã là citext ở DB nên gõ thường hay hoa đều vào được; `uppercase` chỉ là
          // cách hiển thị, KHÔNG đổi giá trị gửi đi.
          className="min-w-40 flex-1 border border-line-strong bg-transparent px-2.5 py-1.5 font-mono text-[14px] text-ink-1 uppercase outline-none focus-visible:border-moss"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!code.trim() || thamGia.isPending}
        >
          {thamGia.isPending ? "Đang vào…" : "Tham gia"}
        </Button>
      </div>
      {loi ? (
        <p role="alert" className="mt-2 text-[13px] text-wa">
          {loi}
        </p>
      ) : null}
      {xong ? <p className="mt-2 text-[13px] text-moss">{xong}</p> : null}
      <p className="mt-2 text-[13px] text-ink-5 font-semibold">
        Chỉ khoá có bật tự ghi danh mới vào được bằng mã. Khoá khác thì nhờ
        mentor ghi danh.
      </p>
    </form>
  );
}
