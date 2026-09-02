/**
 * CodeEditor — bọc CodeMirror 6 (design.md ADR-2: ~300 KB tree-shaken, IME tiếng Việt
 * và cảm ứng tốt hơn Monaco ~5 MB).
 *
 * Phủ FR-E4 (tô màu cú pháp, số dòng, thụt lề tự động, Tab/Shift+Tab, tìm kiếm,
 * undo/redo, chủ đề sáng/tối) và FR-E8 (Ctrl/⌘+Enter chạy thử, Ctrl/⌘+Shift+Enter nộp bài).
 */
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  temporarilySetTabFocusMode,
} from '@codemirror/commands'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { Annotation, EditorState, Prec } from '@codemirror/state'
import { useTheme } from '@/hooks/useTheme'
import {
  baseTheme,
  languageConf,
  languageExtension,
  shellConf,
  shellExtension,
  themeConf,
  themeExtension,
} from './extensions'
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
  type KeyBinding,
} from '@codemirror/view'
import { useEffect, useRef } from 'react'

export interface CodeEditorProps {
  value: string
  onChange: (v: string) => void
  /** Mã ngôn ngữ của judge: `c11` | `cpp17` | `python3` | `java17` | `node20` (FR-F7). */
  languageId: string
  theme?: 'light' | 'dark'
  readOnly?: boolean
  /** FR-E8 · Ctrl/⌘+Enter */
  onRun?: () => void
  /** FR-E8 · Ctrl/⌘+Shift+Enter */
  onSubmit?: () => void
  ariaLabel?: string
}

/**
 * FR-E8 · `Mod-` là Ctrl trên Windows/Linux và ⌘ trên macOS (CodeMirror tự phân
 * giải theo nền tảng), nên chỉ cần một khai báo cho cả hai.
 */
export const RUN_SHORTCUT = 'Mod-Enter'
export const SUBMIT_SHORTCUT = 'Mod-Shift-Enter'

/**
 * Đánh dấu giao dịch do prop `value` từ bên ngoài đẩy vào (ví dụ FR-G1: nạp lại
 * source của một bài nộp cũ) để `onChange` không bắn ngược lên cha — cha vừa là
 * nguồn của thay đổi đó, gọi lại chỉ tạo vòng lặp vô ích.
 */
const externalSync = Annotation.define<boolean>()

/** Gọi handler đang giữ trong ref; trả `false` khi cha không truyền để phím rơi
 *  về hành vi mặc định của CodeMirror thay vì bị nuốt. */
function callRef(ref: { current: (() => void) | undefined }): boolean {
  const handler = ref.current
  if (!handler) return false
  handler()
  return true
}

/**
 * NFR-6 (soạn code chỉ bằng bàn phím): vì Tab đã bị `indentWithTab` chiếm, người
 * dùng bàn phím thoát khỏi editor bằng **Escape rồi Tab** — Escape bật tab-focus
 * mode tạm thời (2 giây) nên phím Tab kế tiếp được trả cho trình duyệt.
 * Trả `false` để không nuốt Escape của lớp ngoài (thoát toàn màn hình — FR-E8).
 */
function escapeToTabFocus(view: EditorView): boolean {
  temporarilySetTabFocusMode(view)
  return false
}

export function CodeEditor({
  value,
  onChange,
  languageId,
  // Mặc định BÁM theo theme của app. Trước đây cắm cứng 'light' và không chỗ nào
  // truyền prop này, nên editor sáng trắng giữa giao diện tối.
  theme: themeProp,
  readOnly = false,
  onRun,
  onSubmit,
  ariaLabel = 'Trình soạn code',
}: CodeEditorProps) {
  const appTheme = useTheme()
  const theme = themeProp ?? appTheme
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)

  // Giữ callback trong ref: keymap và updateListener nằm trong EditorState, nếu
  // đọc trực tiếp từ closure thì mỗi lần cha re-render phải dựng lại extension.
  const onChangeRef = useRef(onChange)
  const onRunRef = useRef(onRun)
  const onSubmitRef = useRef(onSubmit)
  const initialRef = useRef({ value, languageId, theme, readOnly, ariaLabel })

  useEffect(() => {
    onChangeRef.current = onChange
    onRunRef.current = onRun
    onSubmitRef.current = onSubmit
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const init = initialRef.current

    // FR-E8: đăng ký ở Prec.highest để không bị defaultKeymap (Mod-Enter =
    // insertBlankLine) nuốt mất; `preventDefault` để trình duyệt không xử lý tiếp.
    const shortcuts: KeyBinding[] = [
      { key: RUN_SHORTCUT, preventDefault: true, run: () => callRef(onRunRef) },
      { key: SUBMIT_SHORTCUT, preventDefault: true, run: () => callRef(onSubmitRef) },
    ]

    const state = EditorState.create({
      doc: init.value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        highlightSpecialChars(),
        foldGutter(),
        history(),
        drawSelection(),
        dropCursor(),
        rectangularSelection(),
        // FR-E4 · thụt lề tự động khi gõ; 4 dấu cách là đơn vị thụt lề chung
        // (Python bắt buộc dấu cách, C/C++/Java trong tài liệu khoá cũng dùng 4).
        indentOnInput(),
        indentUnit.of('    '),
        bracketMatching(),
        // FR-E4 · ô tìm kiếm (Ctrl/⌘+F) và tô sáng các chỗ trùng
        search({ top: true }),
        highlightSelectionMatches(),
        baseTheme,
        Prec.highest(keymap.of(shortcuts)),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap, // FR-E4 · undo/redo
          ...searchKeymap,
          ...foldKeymap,
          // FR-E4 · Tab/Shift+Tab thụt lề — thay vì chuyển focus.
          indentWithTab,
          // Đặt SAU searchKeymap để Escape vẫn ưu tiên đóng ô tìm kiếm.
          { key: 'Escape', run: escapeToTabFocus },
        ]),
        languageConf.of(languageExtension(init.languageId)),
        themeConf.of(themeExtension(init.theme)),
        shellConf.of(shellExtension(init.readOnly, init.ariaLabel)),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return
          if (update.transactions.some((tr) => tr.annotation(externalSync))) return
          onChangeRef.current(update.state.doc.toString())
        }),
      ],
    })

    const view = new EditorView({ state, parent: host })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  // Đồng bộ `value` từ ngoài vào (FR-G1 nạp lại bài nộp cũ). Chỉ thay tài liệu khi
  // thực sự khác: nếu thay mỗi lần cha re-render, con trỏ sẽ nhảy trong lúc gõ.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (view.state.doc.toString() === value) return
    const anchor = Math.min(view.state.selection.main.anchor, value.length)
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      selection: { anchor },
      annotations: externalSync.of(true),
    })
  }, [value])

  // Đổi ngôn ngữ / chủ đề / readOnly bằng reconfigure compartment thay vì dựng lại
  // EditorView: dựng lại sẽ mất con trỏ và toàn bộ lịch sử undo của người dùng.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: languageConf.reconfigure(languageExtension(languageId)),
    })
  }, [languageId])

  useEffect(() => {
    viewRef.current?.dispatch({ effects: themeConf.reconfigure(themeExtension(theme)) })
  }, [theme])

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: shellConf.reconfigure(shellExtension(readOnly, ariaLabel)),
    })
  }, [readOnly, ariaLabel])

  return <div ref={hostRef} className="h-full min-h-0 overflow-hidden" data-testid="code-editor" />
}

/* Giữ export cũ: nơi khác đang import languageExtension từ file này. */
export { languageExtension }

export default CodeEditor
