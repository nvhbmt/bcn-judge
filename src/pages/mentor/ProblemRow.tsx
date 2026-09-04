/**
 * Một dòng trong danh sách bài tập của mentor (màn 07).
 *
 * Dòng phụ dưới tiêu đề nói LÝ DO bài chưa xuất bản được, không phải chỉ nhắc lại
 * trạng thái. Bản vẽ ghi rõ "chưa xuất bản được — bấm 'kiểm' trước" và "cần tải bộ
 * test lên": hợp đồng nội dung của hệ thiết kế đòi mỗi thông báo phải chỉ chỗ bấm
 * tiếp, và "CHƯA KIỂM" một mình thì không chỉ được gì. Bài đã ổn thì dòng đó dành cho
 * tags.
 */
import { Link } from 'react-router-dom'
import { Row } from '@/components/ui/patterns'
import { ValidationBadge, validationState } from './badges'
import { DIFFICULTY_LABEL, isValidated, type MentorProblemRow } from './types'

/** Lưới cột lấy đúng từ bản vẽ; `RowHead` ở trang cha dùng lại hằng số này. */
export const PROBLEM_COLS = '1fr 140px 108px 96px 116px 96px'

function hint(row: MentorProblemRow): string | null {
  if (row.testcases === 0) return 'cần tải bộ test lên'
  if (!isValidated(row)) return 'chưa xuất bản được — bấm “kiểm” trước'
  return null
}

export function ProblemRow({ row, courseCode }: { row: MentorProblemRow; courseCode: string }) {
  const state = validationState({ testcases: row.testcases, validated: isValidated(row) })
  const canhBao = hint(row)
  const tags = row.tags ?? []

  return (
    <Row
      cols={PROBLEM_COLS}
      accent={row.testcases === 0 ? 'clay' : isValidated(row) ? null : 'earth'}
      interactive
    >
      <span className="min-w-0">
        <Link
          to={`/mentor/bai-tap/${row.id}`}
          className="block truncate text-[16px] font-semibold text-ink-1 hover:underline"
        >
          {row.title}
        </Link>
        <span className={`mt-0.5 block truncate font-mono text-[12px] ${canhBao ? 'text-earth' : 'text-ink-6'}`}>
          {canhBao ?? (tags.length > 0 ? tags.join(' · ') : '—')}
        </span>
      </span>

      <span className="min-w-0">
        <ValidationBadge state={state} />
      </span>

      <span className="num truncate font-mono text-[12px] text-ink-5">
        {row.difficulty ? (DIFFICULTY_LABEL[row.difficulty] ?? row.difficulty) : '—'}
      </span>

      <span className="num truncate font-mono text-[12px] text-ink-5">{courseCode}</span>

      <span className="num font-mono text-[12px] text-ink-5">
        {row.testcases} · bộ #{row.testcaseRev}
      </span>

      <span className="num text-right font-mono text-[12px] text-ink-6">
        {new Date(row.updatedAt).toLocaleString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
        })}
      </span>
    </Row>
  )
}
