/**
 * FR-D6 — nút quan trọng nhất của màn soạn bài: chạy LỜI GIẢI MẪU trên toàn bộ
 * testcase và nói thẳng bộ test có dùng được không.
 *
 * Nó nằm trên một băng riêng ngay dưới thanh tiêu đề, ngoài hai khung chia đôi, vì
 * đây là cửa ra của US-2: soạn xong mà chưa bấm nó thì bộ test vẫn chỉ là phỏng đoán.
 *
 * Nút TỰ CHẶN thay vì để server trả 400, và ba lý do chặn nói ba việc khác nhau:
 *   - chưa có testcase → đi tải zip;
 *   - chưa có lời giải mẫu → đi dán lời giải;
 *   - có sửa chưa lưu → BẤM LƯU TRƯỚC. Cái này là cái bẫy thật: server chạy lời
 *     giải đã lưu trong DB, không phải nội dung đang gõ trên màn hình. Dán lời
 *     giải rồi bấm kiểm ngay sẽ kiểm bằng lời giải CŨ và mentor tin vào một kết
 *     quả không liên quan tới thứ mình vừa dán.
 */
import { ShieldCheck } from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
import { Notice } from './fields'
import { useValidateRun } from './useValidateRun'
import { ValidateReport } from './ValidateReport'

export interface ValidateButtonProps {
  problemId: string | undefined
  testcaseCount: number
  hasSolution: boolean
  /** Form còn thay đổi chưa lưu — xem chú thích đầu file. */
  dirty: boolean
  /** Bộ test hiện tại đã được xác nhận (meta `validated` của GET /:id). */
  validated: boolean
  /** Gọi sau khi lượt kiểm xong để cha nạp lại trạng thái “đã kiểm”. */
  onFinished?: () => void
}

function blockedReason(props: ValidateButtonProps): string | null {
  if (!props.problemId) return 'Bài chưa được tạo.'
  if (props.dirty) return 'Còn thay đổi chưa lưu. Bấm Lưu trước — hệ thống chạy lời giải đã lưu trên máy chủ, không phải nội dung đang gõ.'
  if (!props.hasSolution) return 'Chưa có lời giải mẫu. Dán lời giải ở mục “Lời giải mẫu” rồi lưu.'
  if (props.testcaseCount === 0) return 'Chưa có testcase nào. Tải zip hoặc thêm testcase tay ở thẻ Testcase.'
  return null
}

export function ValidateButton(props: ValidateButtonProps) {
  const { run, start } = useValidateRun(props.problemId, props.onFinished)
  const blocked = blockedReason(props)
  const waiting = run.phase === 'waiting'
  const partial = run.submission?.results?.length ?? 0

  return (
    <section
      aria-label="Kiểm tra testcase bằng lời giải mẫu"
      className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          onClick={() => void start()}
          disabled={blocked !== null || waiting}
          className="px-4 py-2 text-base"
        >
          <ShieldCheck size={18} />
          {waiting ? 'Đang kiểm…' : 'Kiểm tra bằng lời giải mẫu'}
        </Button>

        <p className="text-xs text-slate-500">
          Chạy lời giải mẫu trên cả {props.testcaseCount} testcase và đối chiếu expected output (FR-D6).
        </p>

        {waiting ? (
          <span className="ml-auto">
            <Spinner label={partial > 0 ? `Đã chấm ${partial} testcase…` : 'Đang xếp hàng chấm…'} />
          </span>
        ) : null}
      </div>

      <div className="mt-2 space-y-2">
        {blocked !== null ? <Notice tone="info">{blocked}</Notice> : null}
        {run.phase === 'error' && run.error ? <Notice tone="error">{run.error}</Notice> : null}
        {run.phase === 'done' && run.submission ? <ValidateReport submission={run.submission} /> : null}
        {/* Chưa kiểm lần nào trong phiên này nhưng server nhớ lần trước: đừng bắt bấm lại vô ích. */}
        {run.phase === 'idle' && blocked === null && props.validated ? (
          <Notice tone="ok">Bộ test hiện tại đã được lời giải mẫu xác nhận ở lần kiểm gần nhất.</Notice>
        ) : null}
        {run.phase === 'idle' && blocked === null && !props.validated ? (
          <Notice tone="warn">
            Bộ test hiện tại chưa được kiểm. Xuất bản khi chưa kiểm vẫn được, nhưng phải xác nhận qua cảnh báo (FR-D6).
          </Notice>
        ) : null}
      </div>
    </section>
  )
}
