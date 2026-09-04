/**
 * Kết quả chấm dùng chung cho tab "kết quả" và tab "chạy thử".
 *
 * Bố cục theo kiểu bảng testcase của LeetCode: một dòng tổng kết, một dải chip mỗi test
 * một chip, rồi chi tiết của ĐÚNG MỘT test bên dưới.
 *
 * Vì sao bỏ bảng cũ: bảng liệt kê mọi test rồi mở bảng so ngay dưới mỗi test sai, nên
 * sai 5 test là 5 khối diff xếp chồng, lặp lại y nguyên tiêu đề "input / output của bạn
 * / đáp án đúng". Chiều dài tăng theo số test sai, còn thứ đọc được vẫn chỉ là một khối
 * tại một thời điểm. Dải chip trả lại cái mà bảng cũ làm tốt — nhìn một phát thấy toàn
 * cảnh test nào đạt test nào trượt — mà không tốn chiều cao, và diff giữ nguyên.
 *
 * Mặc định mở test SAI ĐẦU TIÊN, vì đó là câu hỏi người ta mở panel này để hỏi. Test
 * đúng thì mở ra cũng chỉ để xác nhận, không gấp.
 */
import { useState } from 'react'
import { VerdictBadge } from '@/components/ui'
import type { ResultView, SampleIO, SubmissionView } from '@/types/api'
import { VERDICT_LABEL } from '@/types/api'
import { formatDuration, formatMemory } from './format'
import { ResultCase } from './ResultCase'
import { cn } from '@/lib/cn'

export function ResultTable({
  submission,
  samples,
  compareMode,
  emptyText,
}: {
  submission: SubmissionView | null
  samples: SampleIO[]
  compareMode: string
  emptyText: string
}) {
  if (!submission) return <p className="py-4 text-center text-xs text-ink-5">{emptyText}</p>

  if (submission.compileOutput) {
    return (
      <div>
        <p className="mb-1 text-xs font-medium text-wa">Lỗi biên dịch</p>
        <pre className="max-h-60 overflow-auto border border-line bg-surface-code p-2 font-mono text-xs whitespace-pre-wrap text-ink-2">
          {submission.compileOutput}
        </pre>
      </div>
    )
  }

  const results = submission.results ?? []
  if (results.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-ink-5">
        {submission.status === 'done' ? 'Không có kết quả.' : 'Đang chấm…'}
      </p>
    )
  }

  // `key`: lượt chấm khác là câu hỏi khác, nên test đang chọn phải trở về mặc định.
  return <Cases key={submission.id} submission={submission} results={results} samples={samples} compareMode={compareMode} />
}

function Cases({
  submission,
  results,
  samples,
  compareMode,
}: {
  submission: SubmissionView
  results: ResultView[]
  samples: SampleIO[]
  compareMode: string
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const failed = results.find((r) => r.verdict !== 'AC')
  const current = results.find((r) => r.position === picked) ?? failed ?? results[0]!

  // Bàn phím: dải này tự nhận là tablist thì phải đi được bằng mũi tên, không thì lời
  // hứa với trình đọc màn hình là hứa suông.
  const move = (delta: number) => {
    const i = results.findIndex((r) => r.position === current.position)
    setPicked(results[(i + delta + results.length) % results.length]!.position)
  }

  return (
    <div className="flex flex-col gap-2">
      <Summary submission={submission} results={results} />

      <div
        role="tablist"
        aria-label="Testcase"
        className="flex flex-wrap gap-1"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault()
            move(e.key === 'ArrowRight' ? 1 : -1)
          }
        }}
      >
        {results.map((r) => (
          <Chip
            key={r.position}
            result={r}
            selected={r.position === current.position}
            onSelect={() => setPicked(r.position)}
          />
        ))}
      </div>

      <div role="tabpanel" aria-label={`Chi tiết test #${current.position}`}>
        <ResultCase
          result={current}
          sample={samples.find((s) => s.position === current.position) ?? null}
          compareMode={compareMode}
        />
      </div>
    </div>
  )
}

/**
 * Dòng tổng kết: bao nhiêu test đạt, và mốc thời gian / bộ nhớ CAO NHẤT.
 *
 * Cao nhất chứ không phải của test đang xem: giới hạn chấm áp lên test nặng nhất, nên
 * "còn cách trần bao xa" chỉ trả lời được bằng con số lớn nhất trong cả lượt.
 */
function Summary({ submission, results }: { submission: SubmissionView; results: ResultView[] }) {
  const passed = results.filter((r) => r.verdict === 'AC').length
  const time = peak(results.map((r) => r.timeMs))
  const mem = peak(results.map((r) => r.memoryKb))

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <VerdictBadge verdict={submission.verdict} pending={submission.status !== 'done'} />
      <span className="num font-mono text-[13px] text-ink-3">
        {passed}/{results.length} test đạt
      </span>
      <span className="num ml-auto font-mono text-[13px] text-ink-6">
        cao nhất: {formatDuration(time)} · {formatMemory(mem)}
      </span>
    </div>
  )
}

function Chip({
  result,
  selected,
  onSelect,
}: {
  result: ResultView
  selected: boolean
  onSelect: () => void
}) {
  const ok = result.verdict === 'AC'
  const color = `var(--verdict-${result.verdict.toLowerCase()})`

  return (
    <button
      role="tab"
      aria-selected={selected}
      // Nhãn đầy đủ cho trình đọc màn hình: trên màn hình chip chỉ có số và một dấu,
      // còn "mẫu hay ẩn" với "verdict nào" thì nằm ở màu — thứ không đọc thành lời được.
      aria-label={`Test ${result.position}, ${result.isSample ? 'mẫu' : 'ẩn'}, ${VERDICT_LABEL[result.verdict]}`}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      style={{
        color,
        borderColor: selected ? color : 'var(--line)',
        background: selected ? `var(--verdict-${result.verdict.toLowerCase()}-soft)` : 'transparent',
      }}
      // Nét đứt cho test ẩn: khác biệt này có thật (bấm vào không có gì để so) nên nói
      // trước ở chip, đỡ hơn để người ta bấm vào rồi mới biết.
      className={cn(
        'num border px-2 py-0.5 font-mono text-[13px] transition-colors duration-120 ease-linear',
        result.isSample ? '' : 'border-dashed',
        selected ? 'font-semibold' : 'hover:bg-surface-sel',
      )}
    >
      {/* Không chỉ dựa vào màu: dấu ✓/✗ đọc được cả khi không phân biệt được màu. */}
      {ok ? '✓' : '✗'} {result.position}
    </button>
  )
}

function peak(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null)
  return nums.length === 0 ? null : Math.max(...nums)
}
