/**
 * FR-D10 — panel đề bài phải nói rõ khi bài ở dạng hàm.
 *
 * Không phải chuyện thẩm mỹ: người học viết thêm `main` ở bài dạng hàm sẽ trùng
 * điểm vào với harness và nhận CE, mà thông báo của trình biên dịch lúc đó ("multiple
 * definition of main") gần như vô nghĩa với người mới học C.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatementPanel } from '@/pages/workspace/StatementPanel'
import type { ProblemView } from '@/types/api'

const problem = (over: Partial<ProblemView> = {}): ProblemView => ({
  id: 'p1',
  title: 'Two Sum',
  kind: 'function',
  statementMd: 'Cho mảng và target.',
  inputDescMd: null,
  outputDescMd: null,
  constraintsMd: null,
  examples: [],
  timeLimitMs: 1000,
  memoryLimitMb: 256,
  difficulty: 'easy',
  tags: [],
  allowedLanguageIds: null,
  starterCode: {},
  samples: [{ position: 1, input: '1 2\n', expected: '3\n' }],
  hiddenTestcaseCount: 2,
  ...over,
})

describe('StatementPanel — dạng bài', () => {
  it('bài dạng hàm: dặn rõ đừng viết main', () => {
    render(<StatementPanel problem={problem()} />)

    expect(screen.getByText(/Đừng viết hàm main/i)).toBeInTheDocument()
  })

  it('bài stdio: không có lời dặn đó', () => {
    render(<StatementPanel problem={problem({ kind: 'stdio' })} />)

    expect(screen.queryByText(/Đừng viết hàm main/i)).not.toBeInTheDocument()
  })

  it('cả hai dạng đều hiện testcase mẫu và số test ẩn', () => {
    render(<StatementPanel problem={problem()} />)

    expect(screen.getByText('Input')).toBeInTheDocument()
    expect(screen.getByText(/2 testcase ẩn/)).toBeInTheDocument()
  })
})
