import { createContext } from 'react'

/**
 * Cầu nối từ editor sang ô soạn thảo luận: ngôn ngữ (để đóng đúng fence ```lang) và
 * mã NGƯỜI HỌC ĐANG VIẾT, cho nút "Chèn code đang viết".
 *
 * Dùng context thay vì khoan prop qua ThreadCard/ReplyItem: mọi Composer (mở chủ đề,
 * trả lời, sửa) đều cần cùng một thứ, mà chúng nằm rải nhiều cấp. `codeLang` khớp tên
 * ngôn ngữ của highlight.js (c/cpp/python/java/javascript — chính là `cmMode`).
 */
export interface DiscussionEditorInfo {
  codeLang: string
  currentCode: string
}

export const DiscussionEditorContext = createContext<DiscussionEditorInfo>({ codeLang: '', currentCode: '' })
