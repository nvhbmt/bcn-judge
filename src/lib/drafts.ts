/**
 * drafts — FR-E6: tự lưu nháp code theo (người dùng, bài, ngôn ngữ) vào localStorage,
 * "chậm nhất 2 giây sau lần gõ cuối", giữ tối đa 50 nháp gần nhất mỗi người dùng
 * (vượt thì xoá nháp cũ nhất và báo cho người dùng biết).
 *
 * Mọi thao tác đọc/ghi đều bọc try/catch: ở cửa sổ riêng tư (Safari/Firefox) chỉ
 * *chạm* vào `localStorage` đã ném lỗi, và quota có thể đầy giữa chừng. Khi không
 * dùng được localStorage, module tự hạ xuống bộ nhớ trong — nháp vẫn sống trong
 * phiên làm việc, chỉ là không qua được reload.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface DraftKey {
  userId: string
  problemId: string
  languageId: string
}

export interface Draft extends DraftKey {
  source: string
  /** epoch ms — mốc để xác định "nháp cũ nhất" khi phải xoá bớt (LRU). */
  updatedAt: number
}

export interface SaveDraftResult {
  ok: boolean
  /** Số nháp cũ đã bị xoá trong lần lưu này, để UI báo cho người dùng (FR-E6). */
  evicted: number
  reason?: 'quota' | 'serialize'
}

/** FR-E6 v0.5 · "Trình duyệt giữ tối đa 50 nháp gần nhất mỗi người dùng". */
export const MAX_DRAFTS_PER_USER = 50
/** FR-E6 v0.5 · "chậm nhất 2 giây sau lần gõ cuối". */
export const DRAFT_AUTOSAVE_DELAY_MS = 2000

const PREFIX = 'bcn-judge:draft:v1:'
const PROBE_KEY = `${PREFIX}__probe__`

/* ------------------------------------------------------------------ storage */

/** Phần giao của `Storage` mà module này thực sự cần. */
interface KVStore {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function createMemoryStore(): KVStore {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
}

const memoryStore = createMemoryStore()

let cachedStore: KVStore | null = null
let cachedSource: Storage | null | undefined

function readLocalStorage(): Storage | null {
  try {
    // Chỉ đọc thuộc tính cũng có thể ném (cửa sổ riêng tư, cookie bị chặn).
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function getStore(): KVStore {
  const ls = readLocalStorage()
  // Cache theo *danh tính* của localStorage: nếu môi trường đổi (test thay thế,
  // người dùng bật lại quyền lưu trữ) thì thử lại thay vì kẹt ở bộ nhớ trong.
  if (cachedStore && cachedSource === ls) return cachedStore
  cachedSource = ls
  cachedStore = ls && probe(ls) ? ls : memoryStore
  return cachedStore
}

function probe(ls: Storage): boolean {
  try {
    ls.setItem(PROBE_KEY, '1')
    ls.removeItem(PROBE_KEY)
    return true
  } catch {
    return false
  }
}

/** `true` khi nháp thực sự sống qua reload (FR-E6); UI có thể cảnh báo khi `false`. */
export function draftsArePersistent(): boolean {
  return getStore() !== memoryStore
}

/* --------------------------------------------------------------------- keys */

/** Khoá lưu trữ của một nháp. Mã hoá từng phần để id chứa `:` không đụng nhau. */
export function draftStorageKey(key: DraftKey): string {
  return (
    PREFIX +
    [key.userId, key.problemId, key.languageId].map((part) => encodeURIComponent(part)).join(':')
  )
}

function isDraft(value: unknown): value is Draft {
  if (typeof value !== 'object' || value === null) return false
  const d = value as Record<string, unknown>
  return (
    typeof d.userId === 'string' &&
    typeof d.problemId === 'string' &&
    typeof d.languageId === 'string' &&
    typeof d.source === 'string' &&
    typeof d.updatedAt === 'number'
  )
}

function readAt(store: KVStore, storageKey: string): Draft | null {
  try {
    const raw = store.getItem(storageKey)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    // Dữ liệu hỏng (phiên bản cũ, người dùng nghịch devtools) coi như không có nháp.
    return isDraft(parsed) ? parsed : null
  } catch {
    return null
  }
}

function allKeys(store: KVStore): string[] {
  const keys: string[] = []
  try {
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i)
      if (k !== null && k.startsWith(PREFIX) && k !== PROBE_KEY) keys.push(k)
    }
  } catch {
    return keys
  }
  return keys
}

/* ------------------------------------------------------------------ read/write */

export function loadDraft(key: DraftKey): Draft | null {
  return readAt(getStore(), draftStorageKey(key))
}

export function deleteDraft(key: DraftKey): void {
  try {
    getStore().removeItem(draftStorageKey(key))
  } catch {
    // Xoá thất bại không có gì để cứu vãn — im lặng bỏ qua.
  }
}

/**
 * Liệt kê nháp, mới nhất trước. Truyền `userId` để chỉ lấy nháp của một người
 * (khoá lưu trữ dùng chung namespace nên máy dùng chung vẫn tách được).
 */
export function listDrafts(userId?: string): Draft[] {
  const store = getStore()
  const drafts: Draft[] = []
  for (const k of allKeys(store)) {
    const d = readAt(store, k)
    if (d && (userId === undefined || d.userId === userId)) drafts.push(d)
  }
  return drafts.sort((a, b) => b.updatedAt - a.updatedAt)
}

function writeAt(store: KVStore, storageKey: string, payload: string): boolean {
  try {
    store.setItem(storageKey, payload)
    return true
  } catch {
    // Gần như luôn là QuotaExceededError.
    return false
  }
}

/** Xoá nháp cũ nhất của `userId` (không đụng tới `keepKey`). Trả về đã xoá được hay chưa. */
function evictOldest(store: KVStore, userId: string, keepKey: string): boolean {
  let oldest: { key: string; updatedAt: number } | null = null
  for (const k of allKeys(store)) {
    if (k === keepKey) continue
    const d = readAt(store, k)
    if (!d || d.userId !== userId) continue
    if (!oldest || d.updatedAt < oldest.updatedAt) oldest = { key: k, updatedAt: d.updatedAt }
  }
  if (!oldest) return false
  try {
    store.removeItem(oldest.key)
    return true
  } catch {
    return false
  }
}

function countDrafts(store: KVStore, userId: string): number {
  let n = 0
  for (const k of allKeys(store)) {
    const d = readAt(store, k)
    if (d && d.userId === userId) n += 1
  }
  return n
}

/**
 * Lưu nháp. **Không tự debounce** — người gọi (thường là `useDraft`) chịu trách
 * nhiệm gom phím gõ lại; ở đây mỗi lần gọi là một lần ghi thật.
 *
 * Trả về số nháp cũ đã bị xoá để UI hiện thông báo theo FR-E6.
 */
export function saveDraft(key: DraftKey, source: string): SaveDraftResult {
  const store = getStore()
  const storageKey = draftStorageKey(key)
  const draft: Draft = { ...key, source, updatedAt: Date.now() }

  let payload: string
  try {
    payload = JSON.stringify(draft)
  } catch {
    return { ok: false, evicted: 0, reason: 'serialize' }
  }

  let evicted = 0

  // Quota đầy: dọn nháp cũ nhất rồi thử lại. Giới hạn số vòng để không quét
  // toàn bộ localStorage khi lỗi đến từ nguyên nhân khác (ví dụ bị chặn hẳn).
  let written = writeAt(store, storageKey, payload)
  for (let attempt = 0; !written && attempt < MAX_DRAFTS_PER_USER; attempt += 1) {
    if (!evictOldest(store, key.userId, storageKey)) break
    evicted += 1
    written = writeAt(store, storageKey, payload)
  }
  if (!written) return { ok: false, evicted, reason: 'quota' }

  // LRU: giữ tối đa 50 nháp mỗi người, xoá dần cái có `updatedAt` nhỏ nhất.
  let remaining = countDrafts(store, key.userId)
  while (remaining > MAX_DRAFTS_PER_USER) {
    if (!evictOldest(store, key.userId, storageKey)) break
    evicted += 1
    remaining -= 1
  }

  return { ok: true, evicted }
}

/* ---------------------------------------------------------------------- hook */

export type DraftStatus = 'saved' | 'saving' | 'error'

export interface UseDraftOptions {
  /** Ghi đè độ trễ debounce (mặc định 2000 ms theo FR-E6). */
  delayMs?: number
  /** Được gọi khi lần lưu vừa rồi phải xoá nháp cũ — UI dùng để hiện toast. */
  onEvicted?: (count: number) => void
}

/**
 * `useDraft` — state code kèm tự lưu nháp (FR-E6).
 *
 * Trả về `[value, setValue, status]`. `setValue` cập nhật ngay trên UI và hẹn ghi
 * xuống localStorage sau `delayMs` kể từ lần gọi cuối; đổi khoá (đổi bài/ngôn ngữ)
 * hoặc rời trang sẽ ghi ngay phần đang chờ để không mất bài.
 */
export function useDraft(
  key: DraftKey,
  initial = '',
  options: UseDraftOptions = {},
): [string, (next: string) => void, DraftStatus] {
  const { delayMs = DRAFT_AUTOSAVE_DELAY_MS, onEvicted } = options
  const storageKey = draftStorageKey(key)

  const keyRef = useRef(key)
  const initialRef = useRef(initial)
  const onEvictedRef = useRef(onEvicted)
  const mountedRef = useRef(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<string | null>(null)

  const [value, setValue] = useState<string>(() => loadDraft(key)?.source ?? initial)
  const [status, setStatus] = useState<DraftStatus>('saved')

  useEffect(() => {
    onEvictedRef.current = onEvicted
    initialRef.current = initial
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  /** Ghi ngay phần đang chờ (nếu có) bằng khoá hiện hành. */
  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const pending = pendingRef.current
    if (pending === null) return
    pendingRef.current = null
    const result = saveDraft(keyRef.current, pending)
    if (mountedRef.current) setStatus(result.ok ? 'saved' : 'error')
    if (result.evicted > 0) onEvictedRef.current?.(result.evicted)
  }, [])

  const flushRef = useRef(flush)
  flushRef.current = flush

  const keyPropRef = useRef(key)
  keyPropRef.current = key

  // Đổi (bài, ngôn ngữ): cleanup chạy TRƯỚC thân effect mới, lúc đó `keyRef` vẫn
  // là khoá cũ — nên nháp đang gõ dở được ghi đúng chỗ rồi mới nạp nháp mới.
  // Phụ thuộc duy nhất vào `storageKey` (dạng chuỗi ổn định của `key`): nếu phụ
  // thuộc vào chính object `key` thì cha truyền object literal mỗi render sẽ làm
  // effect chạy lại liên tục, ghi đè giá trị đang gõ và reset trạng thái.
  useEffect(() => {
    const current = keyPropRef.current
    keyRef.current = current
    setValue(loadDraft(current)?.source ?? initialRef.current)
    setStatus('saved')
    return () => {
      flushRef.current()
    }
  }, [storageKey])

  // FR-E6 · "không mất khi reload hoặc đóng tab": ghi nốt trước khi trang biến mất.
  useEffect(() => {
    const onLeave = () => flushRef.current()
    window.addEventListener('pagehide', onLeave)
    window.addEventListener('beforeunload', onLeave)
    return () => {
      window.removeEventListener('pagehide', onLeave)
      window.removeEventListener('beforeunload', onLeave)
    }
  }, [])

  const setDraftValue = useCallback(
    (next: string) => {
      setValue(next)
      pendingRef.current = next
      setStatus('saving')
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      // Hẹn lại từ đầu sau mỗi phím gõ ⇒ ghi đúng một lần cho cả tràng gõ.
      timerRef.current = setTimeout(() => flushRef.current(), delayMs)
    },
    [delayMs],
  )

  return [value, setDraftValue, status]
}
