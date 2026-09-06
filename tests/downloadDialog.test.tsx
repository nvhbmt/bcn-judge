/**
 * DownloadDialog: hai lựa chọn gọi đúng mode, thành công thì đóng, lỗi thì báo.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DownloadDialog } from '@/pages/mentor/problem/DownloadDialog'

beforeEach(() => {
  // jsdom không có object URL — stub để nút tải không nổ.
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
  // Chặn "navigation to another Document" khi anchor download bị click trong jsdom.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

function zipRes() {
  // Dựng từ string, KHÔNG từ Blob: jsdom+undici không interop được Blob→Response.
  return new Response('PK', {
    status: 200,
    headers: { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="bai-nop-best.zip"' },
  })
}

function draw(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(<DownloadDialog problemId="p1" onClose={onClose} />, { wrapper })
  return onClose
}

describe('DownloadDialog', () => {
  it('bấm "AC cuối của mỗi người" gọi mode=best rồi đóng', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(zipRes())
    const onClose = draw()
    fireEvent.click(screen.getByRole('button', { name: /AC cuối của mỗi người/ }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(String(fetchSpy.mock.calls[0]![0])).toContain('mode=best')
  })

  it('bấm "Tất cả lượt nộp" gọi mode=all', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(zipRes())
    draw()
    fireEvent.click(screen.getByRole('button', { name: /Tất cả lượt nộp/ }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(String(fetchSpy.mock.calls[0]![0])).toContain('mode=all')
    expect(String(fetchSpy.mock.calls[0]![0])).not.toContain('group=1')
  })

  it('tích "Chia theo nhóm" thì thêm group=1 vào URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(zipRes())
    draw()
    fireEvent.click(screen.getByRole('checkbox', { name: /Chia theo nhóm/ }))
    fireEvent.click(screen.getByRole('button', { name: /AC cuối của mỗi người/ }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(String(fetchSpy.mock.calls[0]![0])).toContain('mode=best')
    expect(String(fetchSpy.mock.calls[0]![0])).toContain('group=1')
  })

  it('lỗi từ server thì hiện thông báo, không đóng', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: { message: 'Chưa có bài nộp nào để tải.' } }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const onClose = draw()
    fireEvent.click(screen.getByRole('button', { name: /AC cuối của mỗi người/ }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Chưa có bài nộp nào để tải.'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
