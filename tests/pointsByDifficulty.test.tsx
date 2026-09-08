/**
 * Điểm theo độ khó (FR-F2 v0.8) — phần giao diện: ba chỗ phải nói được "đạt bao nhiêu
 * trên bao nhiêu", vì một con số 50 đứng một mình không phân biệt được nửa bài dễ với
 * một phần tư bài khó.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CourseSide } from '@/pages/course/CourseSide'
import { SyllabusList } from '@/pages/course/SyllabusList'
import { StatementPanel } from '@/pages/workspace/StatementPanel'
import type { SyllabusSection } from '@/pages/workspace/SyllabusPanel'
import type { CourseDetail, ProblemView } from '@/types/api'

const SECTIONS: SyllabusSection[] = [
  {
    id: 's1',
    title: 'Chương 1',
    position: 1,
    unlockAt: null,
    items: [
      { id: 'i1', title: 'Bài dễ', kind: 'problem', position: 1, status: 'da-ac', attempts: 1, points: 100, maxPoints: 100 },
      { id: 'i2', title: 'Bài khó', kind: 'problem', position: 2, status: 'da-thu', attempts: 3, points: 50, maxPoints: 200 },
      { id: 'i3', title: 'Bài chưa làm', kind: 'problem', position: 3, status: 'chua-lam', attempts: 0, points: null, maxPoints: 150 },
      { id: 'i4', title: 'Bài đọc', kind: 'lesson', position: 4, status: null, attempts: 0, points: null, maxPoints: null },
    ],
  },
]

describe('SyllabusList — điểm đạt / điểm tối đa', () => {
  it('bài đã nộp hiện "điểm/tối đa đ · số lần"; chưa nộp thì "chưa nộp"', () => {
    render(
      <MemoryRouter>
        <SyllabusList courseId="c1" sections={SECTIONS} />
      </MemoryRouter>,
    )
    expect(screen.getByText('100/100 đ · 1 lần')).toBeInTheDocument()
    expect(screen.getByText('50/200 đ · 3 lần')).toBeInTheDocument()
    expect(screen.getByText('chưa nộp')).toBeInTheDocument()
  })

  it('server cũ chưa trả maxPoints thì vẫn hiện điểm, không hiện "/undefined"', () => {
    const cu: SyllabusSection[] = [
      {
        ...SECTIONS[0]!,
        items: [{ id: 'i1', title: 'Bài', kind: 'problem', position: 1, status: 'da-ac', attempts: 2, points: 80 }],
      },
    ]
    render(
      <MemoryRouter>
        <SyllabusList courseId="c1" sections={cu} />
      </MemoryRouter>,
    )
    expect(screen.getByText('80 đ · 2 lần')).toBeInTheDocument()
  })
})

describe('CourseSide — tổng điểm trên tổng có thể', () => {
  const course: CourseDetail = {
    id: 'c1',
    code: 'C1',
    name: 'Khoá',
    descriptionMd: null,
    status: 'open',
    mentors: [],
    languages: [],
  } as unknown as CourseDetail

  it('cộng điểm đạt và điểm tối đa của mọi bài tập, bỏ qua bài đọc', () => {
    render(<CourseSide course={course} sections={SECTIONS} />)
    // 100 + 50 = 150 đạt; 100 + 200 + 150 = 450 có thể.
    expect(screen.getByText(/1\/3 bài AC/)).toBeInTheDocument()
    expect(screen.getByText(/150\/450 điểm/)).toBeInTheDocument()
  })
})

describe('StatementPanel — điểm tối đa cạnh độ khó', () => {
  const problem = (over: Partial<ProblemView> = {}): ProblemView => ({
    id: 'p1',
    title: 'Tổng hai số',
    kind: 'stdio',
    statementMd: 'Đề.',
    inputDescMd: null,
    outputDescMd: null,
    constraintsMd: null,
    examples: [],
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    difficulty: 'hard',
    maxPoints: 200,
    tags: [],
    compareMode: 'trim',
    allowedLanguageIds: null,
    starterCode: {},
    samples: [],
    hiddenTestcaseCount: 1,
    ...over,
  })

  it('"Khó · 200 điểm" đọc như một cặp', () => {
    render(<StatementPanel problem={problem()} />)
    expect(screen.getByText('Khó')).toBeInTheDocument()
    expect(screen.getByText('200 điểm')).toBeInTheDocument()
  })

  it('không có độ khó vẫn hiện điểm tối đa (bài chưa đặt độ khó dùng points_unset)', () => {
    render(<StatementPanel problem={problem({ difficulty: null, maxPoints: 100 })} />)
    expect(screen.getByText('100 điểm')).toBeInTheDocument()
  })

  it('khung xem trước của mentor (maxPoints = 0) thì không hiện dòng điểm', () => {
    render(<StatementPanel problem={problem({ maxPoints: 0 })} />)
    expect(screen.queryByText(/điểm$/)).not.toBeInTheDocument()
  })
})
