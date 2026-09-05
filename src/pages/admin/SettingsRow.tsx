/**
 * MỘT dòng cài đặt: nhãn + câu giải thích bên trái, ô nhập bên phải.
 *
 * Dùng `Row`/`RowGroup` (ngữ pháp bố cục của hệ, xem components/ui/patterns.tsx) chứ
 * không phải lưới hai cột thẻ rời như bản trước: các giới hạn là một DANH SÁCH giá trị
 * đọc theo chiều dọc, và hệ thiết kế chỉ có một cách trình bày danh sách.
 *
 * Tên khoá kỹ thuật (`default_time_limit_ms`) không còn in dưới mỗi ô — nó lặp lại
 * đúng thứ nhãn tiếng Việt vừa nói, mà lại chiếm một dòng trên mọi dòng. Giữ ở
 * `title` để ai đối chiếu với API vẫn tra được. Khoá LẠ thì vẫn hiện nguyên tên, vì
 * `metaFor` lấy chính khoá làm nhãn.
 */
import { Row } from '@/components/ui/patterns'
import { humanBytes, metaFor } from './settingsMeta'
import type { SettingsMap } from './types'
import type { SettingsDraft } from './useSettingsDraft'
import { TextInput } from './ui'

const LABEL = 'block text-[13.5px] leading-snug text-ink-2'
const HINT = 'mt-1 block font-mono text-[11px] leading-snug text-ink-5'

export function SettingsRow({
  settingKey,
  value,
  draft,
}: {
  settingKey: string
  value: SettingsMap[string]
  draft: SettingsDraft
}) {
  const meta = metaFor(settingKey)
  // Dòng đã sửa: nền mang màu + vạch TRONG 3px bên trái (`accent` của Row). Chỉ đổi
  // nền thôi thì ở bản tối nó chênh với surface-2 chừng 3/255 — coi như không có, mà
  // đây đúng là thứ trả lời "tôi vừa đổi những ô nào" trước khi bấm Lưu.
  const accent = settingKey in draft.draft ? 'moss' : null
  const hint = [meta.bytes && typeof value === 'number' ? humanBytes(value) + '.' : null, meta.hint]
    .filter(Boolean)
    .join(' ')

  if (typeof value === 'boolean') {
    return (
      <Row accent={accent}>
        <label title={settingKey} className="flex w-full items-start gap-3">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => draft.set(settingKey, e.target.checked)}
            className="mt-px size-4.5 shrink-0 accent-primary"
          />
          <span className="min-w-0">
            <span className={LABEL}>{meta.label}</span>
            {hint ? <span className={HINT}>{hint}</span> : null}
          </span>
        </label>
      </Row>
    )
  }

  // Khoá mang CHỮ (hiện chỉ có `announcement` — FR-H5) cần cả bề ngang của dòng, nên
  // ô nhập xuống hàng dưới nhãn thay vì đứng cạnh. Đưa chuỗi vào nhánh `type="number"`
  // thì gõ gì cũng không vào được và không có gì báo vì sao.
  if (typeof value === 'string') {
    return (
      <Row accent={accent}>
        <label title={settingKey} className="block w-full">
          <span className={LABEL}>{meta.label}</span>
          <TextInput
            value={value}
            maxLength={500}
            placeholder="Để trống thì không hiện banner"
            onChange={(e) => draft.set(settingKey, e.target.value)}
            className="mt-1.5"
          />
          {hint ? <span className={HINT}>{hint}</span> : null}
        </label>
      </Row>
    )
  }

  return (
    <Row accent={accent}>
      <label title={settingKey} className="flex w-full items-center gap-4">
        <span className="min-w-0 flex-1">
          <span className={LABEL}>{meta.label}</span>
          {hint ? <span className={HINT}>{hint}</span> : null}
        </span>
        <NumberBox
          value={value}
          unit={meta.unit}
          onChange={(next) => (next === null ? draft.drop(settingKey) : draft.set(settingKey, next))}
        />
      </label>
    </Row>
  )
}

/**
 * Ô số có đơn vị in SẴN ở mép phải, trong cùng một khung viền.
 *
 * Đơn vị nằm trong ô chứ không nằm sau nhãn ("Giới hạn thời gian mặc định (ms)") vì
 * nó là thuộc tính của CON SỐ: mắt đọc "1000 ms" một nhịp, còn đọc nhãn rồi mới biết
 * đơn vị thì phải nhớ ngược lại. Viền vẽ ở khung ngoài nên vòng focus bao cả đơn vị.
 */
function NumberBox({
  value,
  unit,
  onChange,
}: {
  value: number | undefined
  unit?: string
  onChange: (next: number | null) => void
}) {
  return (
    <span
      className="flex w-40 shrink-0 items-center border border-line-strong bg-surface-2
 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-primary"
    >
      <input
        type="number"
        inputMode="numeric"
        value={String(value ?? '')}
        onChange={(e) => {
          const next = Number(e.target.value)
          // Ô trống hoặc chữ → bỏ khỏi bản nháp, giữ nguyên giá trị đang chạy.
          onChange(e.target.value === '' || Number.isNaN(next) ? null : next)
        }}
        className="num w-full min-w-0 bg-transparent px-2.5 py-1.5 text-[13px] outline-none"
      />
      {unit ? (
        <span className="shrink-0 pr-2.5 pl-1 font-mono text-[11px] whitespace-nowrap text-ink-5">
          {unit}
        </span>
      ) : null}
    </span>
  )
}
