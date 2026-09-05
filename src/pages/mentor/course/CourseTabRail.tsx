/**
 * Thanh phần của màn sửa khoá — dạng icon, dùng chung `IconRail` với khu làm bài.
 *
 * Trước đây là một cột 192px chỉ có hai dòng chữ ("Thông tin", "Ghi danh") rồi bỏ
 * trống hết phần dưới. Đổi sang icon vì hai lẽ: bề ngang đó trả về cho nội dung, và
 * hai màn có thanh bên thì trông như nhau, người dùng không phải học lại bố cục.
 *
 * Vẫn là LIÊN KẾT thật (`RailItem.href`), không phải nút: mỗi phần có URL riêng nên
 * tải lại trang vẫn ở đúng chỗ, gửi link cho đồng nghiệp thì họ mở ra đúng chỗ mình
 * đang nói, và chuột giữa mở được tab mới. Đó là lý do `IconRail` được mở rộng để
 * nhận `href` thay vì chép thanh thứ hai — phần xử lý chạm ở đó là đoạn khó nhất và
 * không nên có hai bản.
 */
import { Info, ShieldCheck, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconRail } from '@/components/layout/IconRail'
import type { CourseTab, CourseTabId } from './courseTabs'

const ICON: Record<CourseTab['icon'], ReactNode> = {
  info: <Info size={18} />,
  users: <Users size={18} />,
  shield: <ShieldCheck size={18} />,
}

export function CourseTabRail({
  courseId,
  tabs,
  active,
}: {
  courseId: string
  tabs: CourseTab[]
  active: CourseTabId
}) {
  return (
    <IconRail
      ariaLabel="Phần của khoá học"
      activeKey={active}
      // Mọi mục đều có `href` nên nhánh này không bao giờ chạy; router lo điều hướng.
      onSelect={() => {}}
      items={tabs.map((tab) => ({
        key: tab.id,
        label: tab.label,
        icon: ICON[tab.icon],
        href: `/mentor/khoa-hoc/${courseId}/${tab.id}`,
      }))}
    />
  )
}
