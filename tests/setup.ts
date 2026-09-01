/** Setup chung cho vitest + jsdom: matcher của jest-dom, dọn DOM và localStorage giữa các test. */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  // Nhiều component nhớ trạng thái qua localStorage (FR-E1 tỉ lệ split, FR-E6 nháp code) —
  // không dọn thì test này rò trạng thái sang test kia.
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

/*
 * CodeMirror 6 (ADR-2) đo hình học DOM ngay khi dựng view; jsdom thiếu các API đo
 * đạc dưới đây nên mọi test chạm tới editor sẽ ném lỗi nếu không stub.
 */
const emptyRect: DOMRect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
}

function emptyRectList(): DOMRectList {
  return {
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () {
      // jsdom không bố cục thật nên không có rect nào để trả về
    },
  } as unknown as DOMRectList
}

if (typeof Range !== 'undefined') {
  Range.prototype.getBoundingClientRect ??= () => emptyRect
  Range.prototype.getClientRects ??= () => emptyRectList()
}

Element.prototype.getClientRects ??= () => emptyRectList()
Element.prototype.scrollIntoView ??= () => {}

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

if (!('IntersectionObserver' in globalThis)) {
  globalThis.IntersectionObserver = class {
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds: readonly number[] = []
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  } as unknown as typeof IntersectionObserver
}
