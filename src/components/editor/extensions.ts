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
 *
 * Bảng phải phủ ĐỦ, không phủ một nửa. Bản trước chỉ khai tám dòng rồi để
 * `defaultHighlightStyle` đỡ phần còn lại, mà bảng mặc định của CodeMirror là màu
 * nguyên chất cho nền trắng của chính nó: `definition(variableName)` ra `#00f`,
 * `local(variableName)` ra `#30a`, `comment` ra `#940`. Trên nền kem của bản sáng,
 * `int main` thành tím-xanh chói đứng cạnh `#include` nâu ấm — trông đúng như editor
 * chưa được làm cho bản sáng, dù bốn token `--syn-*` đều đạt 6,9–8,1:1.
 *
 * Nguyên tắc phân màu: chỉ tô thứ MANG NGHĨA. Định danh để nguyên màu chữ, dấu câu
 * mờ đi một bậc — code nào cũng đầy hai loại này, tô chúng là biến màn hình thành
 * cầu vồng và làm chìm mất thứ đáng chú ý.
 */
const synHighlight = HighlightStyle.define([
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword, tags.operatorKeyword, tags.definitionKeyword, tags.modifier, tags.self], color: 'var(--syn-keyword)' },
  { tag: [tags.typeName, tags.standard(tags.typeName), tags.className, tags.namespace], color: 'var(--syn-keyword)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName, tags.labelName], color: 'var(--syn-func)' },
  { tag: [tags.meta, tags.processingInstruction, tags.annotation], color: 'var(--syn-func)' },
  { tag: [tags.number, tags.integer, tags.float, tags.bool, tags.null, tags.atom, tags.unit, tags.constant(tags.variableName)], color: 'var(--syn-number)' },
  { tag: [tags.string, tags.special(tags.string), tags.character, tags.regexp, tags.escape], color: 'var(--syn-string)' },

  // Định danh và dấu câu: KHÔNG tô. Khai tường minh để chúng không rơi xuống bảng
  // mặc định của CodeMirror — đó chính là chỗ `#00f` lọt vào bản sáng.
  { tag: [tags.variableName, tags.definition(tags.variableName), tags.local(tags.variableName), tags.special(tags.variableName), tags.propertyName, tags.definition(tags.propertyName), tags.attributeName], color: 'var(--ink-2)' },
  { tag: [tags.operator, tags.punctuation, tags.separator, tags.bracket, tags.paren, tags.brace, tags.squareBracket, tags.angleBracket, tags.derefOperator], color: 'var(--ink-4)' },

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
    '&': { backgroundColor: 'var(--surface-editor)', color: 'var(--ink-2)' },
    '.cm-content': { caretColor: 'var(--moss)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--moss)' },
    '.cm-gutters': {
      backgroundColor: 'var(--surface-editor)',
      color: 'var(--ink-6)',
      border: 'none',
      borderRight: '1px solid var(--line)',
    },
    // `--line-active` TRONG SUỐT, không phải `--surface-sel` đục: lớp vùng chọn của
    // CodeMirror nằm ở z-index -2 (sau nội dung), nên nền đục trên .cm-line che mất
    // vệt bôi đen ngay trên dòng đang gõ. Alpha của token hợp thành đúng màu cũ khi
    // không có vùng chọn, nên giao diện lúc gõ bình thường không đổi.
    '.cm-activeLine': { backgroundColor: 'var(--line-active)' },
    '.cm-activeLineGutter': { backgroundColor: 'var(--line-active)', color: 'var(--ink-4)' },
    /*
     * Vùng chọn: `--select-bg`, KHÔNG phải `--surface-sel`. Dòng đang gõ đã dùng
     * `--surface-sel`, nên vùng chọn dùng chung màu thì bôi đen ngay trên dòng đó
     * không thấy gì — design-system tách riêng token này đúng vì lẽ đó.
     *
     * Selector phải viết ĐỦ DÀI. baseTheme của CodeMirror khai
     * `&light.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground`
     * (5 lớp); rule ngắn hơn thua độ đặc hiệu và vùng chọn lặng lẽ giữ nguyên màu
     * mặc định #d7d4f0 — tím xanh lạnh, lạc hẳn khỏi thang màu ấm của hệ này.
     * Dùng `background` chứ không `backgroundColor` để khớp đúng thuộc tính nó đặt.
     */
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
      background: 'var(--select-bg)',
    },
    '& > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
      background: 'var(--select-bg)',
    },
    '.cm-content ::selection': { background: 'var(--select-bg)' },
    // Chỗ trùng với vùng đang chọn: cùng họ nghĩa với `.cm-searchMatch` ("những chỗ
    // khác khớp với cái này") nên dùng chung màu, và cũng để không đụng `--surface-sel`.
    '.cm-selectionMatch': { backgroundColor: 'var(--tint-earth)' },
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
