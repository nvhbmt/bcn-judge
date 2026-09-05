/**
 * Hai chỗ bấm Lưu của trang cài đặt — và chúng không thừa nhau.
 *
 * `SettingsSaveButton` đứng ở hàng tiêu đề, chỗ `AdminShell` đặt MỌI hành động cấp
 * trang: mở trang lên là thấy ngay hành động chính, luôn cùng một vị trí với các trang
 * quản trị khác.
 *
 * `UnsavedBar` chỉ hiện khi có ô đã sửa. Cột giới hạn dài hơn một màn, nên sửa xong ô
 * cuối mà nút Lưu đã trôi khỏi tầm mắt thì phải cuộn ngược lên mới lưu được. Băng này
 * cũng là chỗ nói CÓ BAO NHIÊU ô đang chờ lưu và là lối hoàn tác.
 */
import { Button } from '@/components/ui'
import type { SettingsDraft } from './useSettingsDraft'

export function SettingsSaveButton({ draft }: { draft: SettingsDraft }) {
  return (
    <Button
      variant="primary"
      onClick={draft.submit}
      disabled={draft.saving || draft.dirtyKeys.length === 0}
      title={draft.dirtyKeys.length === 0 ? 'Chưa có thay đổi nào để lưu' : undefined}
    >
      {draft.saving ? 'Đang lưu…' : 'Lưu cài đặt'}
    </Button>
  )
}

export function UnsavedBar({ draft }: { draft: SettingsDraft }) {
  const dem = draft.dirtyKeys.length
  if (dem === 0) return null

  // Nội dung cuộn CHUI XUỐNG dưới băng này nên nền phải đục và phải LẤY TỪ TOKEN: một
  // màu cứng vừa không đổi theo theme vừa là thứ duy nhất còn sót của thang xám lạnh
  // cũ — ở bản tối nó thành vạch sáng trắng vắt ngang trang. `--surface-1` vì nền trang
  // là `--surface-0` còn các khối là `--surface-2`: bậc duy nhất tách khỏi cả hai.
  return (
    <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-line bg-surface-1 px-4 py-3">
      <span className="text-[13px] text-ink-3">
        <span className="num font-semibold">{dem}</span> mục chưa lưu
      </span>
      <Button variant="quiet" onClick={draft.reset} className="ml-auto">
        Hoàn tác
      </Button>
      <Button variant="primary" onClick={draft.submit} disabled={draft.saving}>
        {draft.saving ? 'Đang lưu…' : `Lưu ${dem} thay đổi`}
      </Button>
    </div>
  )
}
