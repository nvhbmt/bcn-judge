/** Test cho `src/lib/drafts.ts` — FR-E6 (tự lưu nháp, giới hạn 50 nháp/người). */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DRAFT_AUTOSAVE_DELAY_MS,
  MAX_DRAFTS_PER_USER,
  deleteDraft,
  draftStorageKey,
  draftsArePersistent,
  listDrafts,
  loadDraft,
  saveDraft,
  useDraft,
} from '@/lib/drafts'

const KEY = { userId: 'u1', problemId: 'p1', languageId: 'cpp17' }

function clearStorage() {
  try {
    localStorage.clear()
  } catch {
    // bỏ qua
  }
}

/** Thay `localStorage` bằng một getter ném lỗi (mô phỏng cửa sổ riêng tư). */
function withBrokenLocalStorage(run: () => void) {
  const own = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('Bộ nhớ cục bộ bị chặn')
    },
  })
  try {
    run()
  } finally {
    if (own) Object.defineProperty(globalThis, 'localStorage', own)
    else delete (globalThis as { localStorage?: unknown }).localStorage
  }
}

beforeEach(() => {
  clearStorage()
  // Chạm vào store một lần để cache quay lại localStorage thật sau các test hỏng store.
  draftsArePersistent()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  clearStorage()
})

describe('saveDraft / loadDraft', () => {
  it('lưu rồi đọc lại đúng source', () => {
    const result = saveDraft(KEY, '#include <bits/stdc++.h>')
    expect(result).toMatchObject({ ok: true, evicted: 0 })

    const loaded = loadDraft(KEY)
    expect(loaded?.source).toBe('#include <bits/stdc++.h>')
    expect(loaded?.languageId).toBe('cpp17')
    expect(loaded?.updatedAt).toBeTypeOf('number')
  })

  it('tách nháp theo (người dùng, bài, ngôn ngữ)', () => {
    saveDraft(KEY, 'cpp')
    saveDraft({ ...KEY, languageId: 'python3' }, 'py')
    saveDraft({ ...KEY, userId: 'u2' }, 'khac nguoi')

    expect(loadDraft(KEY)?.source).toBe('cpp')
    expect(loadDraft({ ...KEY, languageId: 'python3' })?.source).toBe('py')
    expect(listDrafts('u1')).toHaveLength(2)
    expect(listDrafts('u2')).toHaveLength(1)
  })

  it('id chứa dấu hai chấm không làm lẫn khoá', () => {
    const a = draftStorageKey({ userId: 'a:b', problemId: 'c', languageId: 'c11' })
    const b = draftStorageKey({ userId: 'a', problemId: 'b:c', languageId: 'c11' })
    expect(a).not.toBe(b)
  })

  it('deleteDraft xoá nháp', () => {
    saveDraft(KEY, 'x')
    deleteDraft(KEY)
    expect(loadDraft(KEY)).toBeNull()
  })

  it('trả null khi chưa có nháp hoặc dữ liệu hỏng', () => {
    expect(loadDraft(KEY)).toBeNull()
    localStorage.setItem(draftStorageKey(KEY), '{khong-phai-json')
    expect(loadDraft(KEY)).toBeNull()
  })
})

describe('LRU 50 nháp mỗi người (FR-E6)', () => {
  it('xoá nháp cũ nhất khi vượt 50 và báo số lượng đã xoá', () => {
    vi.useFakeTimers()
    const base = new Date('2026-01-01T00:00:00Z').getTime()

    const results: number[] = []
    for (let i = 0; i < MAX_DRAFTS_PER_USER + 5; i += 1) {
      // Mỗi nháp một mốc thời gian khác nhau để thứ tự "cũ nhất" xác định được.
      vi.setSystemTime(base + i * 1000)
      results.push(saveDraft({ ...KEY, problemId: `p${i}` }, `code ${i}`).evicted)
    }

    // 50 lần đầu không xoá gì, 5 lần sau mỗi lần xoá đúng một nháp cũ nhất.
    expect(results.slice(0, MAX_DRAFTS_PER_USER)).toEqual(
      Array(MAX_DRAFTS_PER_USER).fill(0) as number[],
    )
    expect(results.slice(MAX_DRAFTS_PER_USER)).toEqual([1, 1, 1, 1, 1])

    const drafts = listDrafts('u1')
    expect(drafts).toHaveLength(MAX_DRAFTS_PER_USER)
    // p0..p4 (cũ nhất) đã bị xoá, p5..p54 còn lại.
    expect(loadDraft({ ...KEY, problemId: 'p0' })).toBeNull()
    expect(loadDraft({ ...KEY, problemId: 'p4' })).toBeNull()
    expect(loadDraft({ ...KEY, problemId: 'p5' })?.source).toBe('code 5')
    expect(drafts[0]?.problemId).toBe('p54')
  })

  it('không đụng tới nháp của người dùng khác khi dọn', () => {
    vi.useFakeTimers()
    const base = Date.now()
    vi.setSystemTime(base)
    saveDraft({ userId: 'u2', problemId: 'giu-lai', languageId: 'c11' }, 'cua u2')

    for (let i = 0; i < MAX_DRAFTS_PER_USER + 3; i += 1) {
      vi.setSystemTime(base + 1000 + i * 1000)
      saveDraft({ ...KEY, problemId: `p${i}` }, `code ${i}`)
    }

    expect(listDrafts('u1')).toHaveLength(MAX_DRAFTS_PER_USER)
    expect(loadDraft({ userId: 'u2', problemId: 'giu-lai', languageId: 'c11' })?.source).toBe(
      'cua u2',
    )
  })
})

describe('localStorage không dùng được', () => {
  it('hạ xuống bộ nhớ trong, không ném lỗi', () => {
    withBrokenLocalStorage(() => {
      expect(draftsArePersistent()).toBe(false)
      expect(() => saveDraft(KEY, 'trong bo nho')).not.toThrow()
      expect(loadDraft(KEY)?.source).toBe('trong bo nho')
      expect(listDrafts('u1')).toHaveLength(1)
      expect(() => deleteDraft(KEY)).not.toThrow()
      expect(loadDraft(KEY)).toBeNull()
    })
  })

  it('quota đầy: trả ok=false thay vì ném lỗi', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string) => {
      // Cho phép probe đi qua để module vẫn chọn localStorage thật.
      if (key.endsWith('__probe__')) return
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })
    const result = saveDraft(KEY, 'x')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('quota')
  })
})

describe('useDraft (FR-E6 · chậm nhất 2 giây sau lần gõ cuối)', () => {
  it('gom cả tràng gõ thành đúng một lần ghi', () => {
    vi.useFakeTimers()
    const writes: string[] = []
    const realSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key.startsWith('bcn-judge:draft:v1:') && !key.endsWith('__probe__')) writes.push(value)
      realSetItem.call(this, key, value)
    })

    const { result } = renderHook(() => useDraft(KEY, 'khoi tao'))
    expect(result.current[0]).toBe('khoi tao')
    expect(result.current[2]).toBe('saved')

    act(() => {
      for (const s of ['i', 'in', 'int', 'int ', 'int main']) result.current[1](s)
    })
    expect(result.current[0]).toBe('int main')
    expect(result.current[2]).toBe('saving')
    expect(writes).toHaveLength(0)

    // Chưa tới 2 giây thì chưa ghi.
    act(() => {
      vi.advanceTimersByTime(DRAFT_AUTOSAVE_DELAY_MS - 1)
    })
    expect(writes).toHaveLength(0)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(writes).toHaveLength(1)
    expect(result.current[2]).toBe('saved')
    expect(loadDraft(KEY)?.source).toBe('int main')
  })

  it('nạp lại nháp đã lưu thay vì giá trị khởi tạo', () => {
    saveDraft(KEY, 'nhap cu')
    const { result } = renderHook(() => useDraft(KEY, 'starter code'))
    expect(result.current[0]).toBe('nhap cu')
  })

  it('đổi ngôn ngữ thì ghi ngay nháp cũ rồi nạp nháp của ngôn ngữ mới', () => {
    vi.useFakeTimers()
    saveDraft({ ...KEY, languageId: 'python3' }, 'print(1)')

    const { result, rerender } = renderHook(
      ({ languageId }: { languageId: string }) => useDraft({ ...KEY, languageId }, ''),
      { initialProps: { languageId: 'cpp17' } },
    )

    act(() => {
      result.current[1]('int main(){}')
    })
    // Chưa hết 2 giây, nhưng đổi khoá phải flush ngay để không mất bài.
    act(() => {
      rerender({ languageId: 'python3' })
    })

    expect(loadDraft(KEY)?.source).toBe('int main(){}')
    expect(result.current[0]).toBe('print(1)')
  })

  it('báo số nháp bị xoá qua onEvicted', () => {
    vi.useFakeTimers()
    const base = new Date('2026-02-01T00:00:00Z').getTime()
    for (let i = 0; i < MAX_DRAFTS_PER_USER; i += 1) {
      vi.setSystemTime(base + i * 1000)
      saveDraft({ ...KEY, problemId: `seed${i}` }, `code ${i}`)
    }

    const onEvicted = vi.fn()
    vi.setSystemTime(base + 999_000)
    const { result } = renderHook(() => useDraft(KEY, '', { onEvicted }))
    act(() => {
      result.current[1]('bai moi')
    })
    act(() => {
      vi.advanceTimersByTime(DRAFT_AUTOSAVE_DELAY_MS)
    })

    expect(onEvicted).toHaveBeenCalledWith(1)
    expect(listDrafts('u1')).toHaveLength(MAX_DRAFTS_PER_USER)
  })

  it('trạng thái error khi ghi thất bại', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDraft(KEY, ''))

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string) => {
      if (key.endsWith('__probe__')) return
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })

    act(() => {
      result.current[1]('x')
    })
    act(() => {
      vi.advanceTimersByTime(DRAFT_AUTOSAVE_DELAY_MS)
    })
    expect(result.current[2]).toBe('error')
  })
})
