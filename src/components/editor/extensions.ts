/**
 * Cấu hình CodeMirror tách khỏi component React.
 *
 * Tách ra vì hai lý do, không phải để lách trần 250 dòng: đây là **cấu hình**, không
 * phải giao diện — nó không dùng hook nào, kiểm được bằng test thuần — và nó là chỗ
 * duy nhất biết về ánh xạ ngôn ngữ, nên thêm ngôn ngữ mới chỉ đụng một file.
 */
import { cpp } from '@codemirror/lang-cpp'
import { java } from '@codemirror/lang-java'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { tags } from '@lezer/highlight'
import { EditorView } from '@codemirror/view'

// Compartment chỉ là "khoá định danh" trong state của từng view, nên dùng chung
// ở mức module vẫn an toàn khi có nhiều editor trên cùng màn hình.
export const languageConf = new Compartment()
export const themeConf = new Compartment()
/** readOnly + aria-label: cả hai chỉ đổi thuộc tính DOM, gộp một compartment. */
export const shellConf = new Compartment()

/**
 * Ánh xạ mã ngôn ngữ judge → language support của CodeMirror.
 * Ngôn ngữ lạ (thêm bằng cấu hình theo FR-F7) trả về `[]` — editor vẫn chạy ở chế
 * độ văn bản thuần, tuyệt đối không ném lỗi làm sập cả màn hình làm bài.
 */
export function languageExtension(languageId: string): Extension {
  switch (languageId) {
    case 'c11':
    case 'cpp17':
      return cpp()
    case 'python3':
      return python()
    case 'java17':
      return java()
    case 'node20':
      return javascript()
    default:
      return []
  }
}

/**
 * Tô màu cú pháp lấy từ `--syn-*` của hệ thiết kế.
 *
 * KHÔNG dùng `oneDark`: nó là xám-xanh lạnh (#282c34), đá thẳng với thang trung
 * tính ấm của hệ này — nhìn ra ngay là editor "của thư viện khác" dán vào. Bảng
 * dưới đây đọc biến CSS nên tự đổi theo theme, một định nghĩa cho cả hai bản.
 */
const synHighlight = HighlightStyle.define([
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword, tags.operatorKeyword], color: 'var(--syn-keyword)' },
  { tag: [tags.typeName, tags.standard(tags.typeName), tags.definitionKeyword], color: 'var(--syn-keyword)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName], color: 'var(--syn-func)' },
  { tag: [tags.number, tags.integer, tags.float, tags.bool, tags.null], color: 'var(--syn-number)' },
  { tag: [tags.string, tags.special(tags.string), tags.character], color: 'var(--syn-string)' },
  { tag: [tags.meta, tags.processingInstruction], color: 'var(--syn-func)' },
  { tag: tags.invalid, color: 'var(--clay)' },
])

/**
 * Khung editor: nền, con trỏ, vùng chọn, số dòng — tất cả bám token.
 *
 * Dựng hai bản chỉ khác cờ `dark`. Màu thì giống hệt (đều là biến CSS), nhưng
 * CodeMirror đọc facet `EditorView.darkTheme` để tự chọn mặc định cho vài thành
 * phần dựng sẵn của nó — đặt sai thì thanh tìm kiếm và tooltip lệch tông.
 */
const makeSurfaceTheme = (dark: boolean) =>
  EditorView.theme({
    '&': { backgroundColor: 'var(--surface-3)', color: 'var(--ink-2)' },
    '.cm-content': { caretColor: 'var(--moss)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--moss)' },
    '.cm-gutters': {
      backgroundColor: 'var(--surface-3)',
      color: 'var(--ink-6)',
      border: 'none',
      borderRight: '1px solid var(--line)',
    },
    '.cm-activeLine': { backgroundColor: 'var(--surface-sel)' },
    '.cm-activeLineGutter': { backgroundColor: 'var(--surface-sel)', color: 'var(--ink-4)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'var(--surface-sel)',
    },
    '.cm-selectionMatch': { backgroundColor: 'var(--surface-sel)' },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
      backgroundColor: 'transparent',
      outline: '1px solid var(--line-strong)',
    },
    '.cm-panels': { backgroundColor: 'var(--surface-1)', color: 'var(--ink-2)' },
    '.cm-searchMatch': { backgroundColor: 'var(--tint-earth)' },
  }, { dark })

const SURFACE_LIGHT = makeSurfaceTheme(false)
const SURFACE_DARK = makeSurfaceTheme(true)

/** Màu đến từ biến CSS nên hai bản giống nhau; chỉ khác cờ `dark` cho CodeMirror. */
export function themeExtension(theme: 'light' | 'dark'): Extension {
  return [theme === 'dark' ? SURFACE_DARK : SURFACE_LIGHT, syntaxHighlighting(synHighlight)]
}

export function shellExtension(readOnly: boolean, ariaLabel: string): Extension {
  return [
    // Cần cả hai: `readOnly` chặn các lệnh sửa, `editable` chặn gõ thẳng vào DOM.
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
  ]
}

/** Lấy font mono từ token của hệ thiết kế thay vì cắm cứng — editor và phần còn
 *  lại của app phải cùng một họ chữ, nếu không code trong đề và code đang gõ khác font. */
export const baseTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.5',
  },
})
