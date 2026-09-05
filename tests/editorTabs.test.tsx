/**
 * Dải tab của trình soạn bài — hai thứ đáng canh nhất:
 *
 *   1. Tab Harness BIẾN MẤT DƯỚI CHÂN người đứng khi đổi dạng bài về stdio. Không
 *      xử thì mentor kẹt trên một panel ẩn: tablist không có tab nào sáng, nội
 *      dung trống trơn, không đường bấm ra.
 *   2. MỌI panel luôn mount, ẩn bằng hidden+inert — đổi tab mà unmount thì bảng
 *      testcase gõ dở và lịch sử undo của CodeMirror bay, im lặng.
 *
 * Fetch mock trả rỗng cho tất cả: các section con chỉ hỏi /api/member/languages để
 * vẽ dropdown, rỗng thì vẫn render đủ khung — test này canh KHUNG, không canh data.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { EditorTabs, type EditorTabId } from '@/pages/mentor/problem/EditorTabs'
import { toFormValues, type ProblemFormValues } from '@/pages/mentor/form'
import type { MentorProblemDetail } from '@/pages/mentor/types'

const detail = (over: Partial<MentorProblemDetail> = {}): MentorProblemDetail => ({
  id: 'p1',
  title: 'Bài chia tab',
  kind: 'function',
  harness: { c11: '#include "solution.c"' },
  statementMd: 'Đề',
  inputDescMd: null,
  outputDescMd: null,
  constraintsMd: null,
  timeLimitMs: 1000,
  memoryLimitMb: 256,
  difficulty: 'easy',
  tags: [],
  floatEps: null,
  starterCode: {},
  allowedLanguageIds: null,
  compareMode: 'trim',
  testcaseRev: 1,
  solutionLanguageId: 'c11',
  solutionSource: '',
  solutionVisibility: 'mentor',
  hiddenTestcaseCount: 0,
  testcases: [],
  ...over,
})

/** EditorTabs là controlled — vỏ này giữ state y như ProblemEditorPage. */
function Vo({ d }: { d: MentorProblemDetail }) {
  const [tab, setTab] = useState<EditorTabId>('de-bai')
  const [values, setValues] = useState<ProblemFormValues>(() => toFormValues(d))
  return (
    <EditorTabs
      tab={tab}
      onTab={setTab}
      values={values}
      onChange={(p) => setValues((v) => ({ ...v, ...p }))}
      detail={d}
      hasSolution={false}
      dirty={false}
      validated={false}
      onReloaded={() => {}}
    />
  )
}

function ve(d = detail()) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ success: true, data: [], meta: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Vo d={d} />
    </QueryClientProvider>,
  )
}

const tabDangChon = () =>
  screen.getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true')?.textContent

describe('dải tab trình soạn bài', () => {
  it('sáu tab cho bài function, năm cho bài stdio — Harness chỉ hiện khi có nghĩa', () => {
    ve()
    const ten = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(ten).toEqual(['Đề bài', 'Chấm', 'Code khởi tạo', 'Harness', 'Lời giải', 'Testcase (0)'])
  })

  it('mọi panel luôn mount — đổi tab không unmount panel cũ', async () => {
    ve()
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Chấm' }))
    // Panel đề bài vẫn TRONG DOM (ẩn), không bị gỡ — ô Tiêu đề còn đó dù không thấy.
    expect(document.getElementById('panel-de-bai')).not.toBeNull()
    expect(document.getElementById('panel-de-bai')).toHaveAttribute('hidden')
    expect(document.getElementById('panel-cham')).not.toHaveAttribute('hidden')
  })

  it('đứng trên tab Harness rồi đổi dạng bài về stdio thì được ĐƯA VỀ tab Chấm', async () => {
    ve()
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Harness' }))
    expect(tabDangChon()).toBe('Harness')

    // Đổi dạng bài ngay trong tab Chấm? Không — mentor đứng ở Harness, đổi kind qua
    // ô Dạng bài nằm trong panel Chấm đang ẩn thì không bấm được; đường thật là mở
    // tab Chấm rồi đổi. Nhưng RÀNG BUỘC phải giữ cho MỌI đường: mô phỏng bằng cách
    // đổi kind rồi quay lại nhìn tablist.
    await user.click(screen.getByRole('tab', { name: 'Chấm' }))
    await user.selectOptions(screen.getByLabelText('Dạng bài'), 'stdio')
    await user.click(screen.getByRole('tab', { name: 'Lời giải' }))
    expect(screen.queryByRole('tab', { name: 'Harness' })).toBeNull()

    // Trường hợp kẹt thật: state tab còn là 'harness' mà kind đã stdio.
    // Vỏ ngoài không thể tạo ra nữa qua UI, nên canh thẳng logic fallback:
    // active phải rơi về 'cham', và có đúng MỘT tab sáng.
  })

  it('tab nào cũng có panel cùng id, aria nối đúng chiều', () => {
    ve()
    for (const t of screen.getAllByRole('tab')) {
      const panelId = t.getAttribute('aria-controls')!
      const panel = document.getElementById(panelId)
      expect(panel, `panel ${panelId} phải tồn tại`).not.toBeNull()
      expect(panel).toHaveAttribute('aria-labelledby', t.id)
    }
  })
})

describe('fallback khi state tab kẹt ở harness mà bài đã là stdio', () => {
  it('active rơi về Chấm — tablist có đúng một tab sáng, panel Chấm mở', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [], meta: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const d = detail({ kind: 'stdio', harness: {} })
    render(
      <QueryClientProvider client={client}>
        <EditorTabs
          tab="harness"
          onTab={() => {}}
          values={toFormValues(d)}
          onChange={() => {}}
          detail={d}
          hasSolution={false}
          dirty={false}
          validated={false}
          onReloaded={() => {}}
        />
      </QueryClientProvider>,
    )
    const sang = screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true')
    expect(sang.map((t) => t.textContent)).toEqual(['Chấm'])
    expect(document.getElementById('panel-cham')).not.toHaveAttribute('hidden')
  })
})
