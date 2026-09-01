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
    <Row accent={row.testcases === 0 ? 'clay' : isValidated(row) ? null : 'earth'} interactive className="gap-4">
      <span className="min-w-0 flex-1">
        <Link
          to={`/mentor/bai-tap/${row.id}`}
          className="block truncate text-[14px] font-medium text-ink-1 hover:underline"
        >
          {row.title}
        </Link>
        <span className={`mt-0.5 block truncate font-mono text-[11px] ${canhBao ? 'text-earth' : 'text-ink-6'}`}>
          {canhBao ?? (tags.length > 0 ? tags.join(' · ') : '—')}
        </span>
      </span>

      <span className="hidden w-28 shrink-0 sm:block">
        <ValidationBadge state={state} />
      </span>

      <span className="num hidden w-20 shrink-0 truncate font-mono text-[11px] whitespace-nowrap text-ink-5 lg:block">
        {row.difficulty ? (DIFFICULTY_LABEL[row.difficulty] ?? row.difficulty) : '—'}
      </span>

      <span className="num hidden w-24 shrink-0 truncate font-mono text-[11px] text-ink-5 lg:block">{courseCode}</span>

      <span className="num w-24 shrink-0 text-right font-mono text-[11px] text-ink-5">
        {row.testcases} · bộ #{row.testcaseRev}
      </span>

      <span className="num hidden w-24 shrink-0 text-right font-mono text-[11px] text-ink-6 md:block">
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
