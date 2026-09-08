/**
 * Mục "Lời giải" của thanh icon (FR-K v0.8): bài AC tốt nhất của người khác, lời giải mẫu
 * của mentor (khi bài cho phép — FR-D7), và màn so sánh với bài của mình.
 *
 * Ba trạng thái đóng nói ba chuyện khác nhau, không gộp: CHƯA GIẢI (khoá — làm đi rồi
 * quay lại), CẤM VẬN contest (mở lại lúc mấy giờ — không phải lỗi của người xem), và
 * RỖNG (đã mở nhưng chưa ai chia sẻ). Server là cổng: canAccess=false thì không có một
 * byte source nào trong phản hồi, đây chỉ dựng câu chữ.
 *
 * Không có nút "nạp vào editor" cho bài của người khác — có là biến mục này thành nút
 * chép; so sánh thì đặt cạnh nhau là đủ.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, SectionRule, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import type { LanguageOption } from '@/types/api'
import { CompareView } from './CompareView'
import { PeerList } from './PeerList'
import { ReferenceCard } from './ReferenceCard'
import type { PeerSolution, SolutionSort, SolutionsData } from './types'

function Closed({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-4 py-10">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
        <Lock size={28} className="text-ink-5" />
        <p className="font-display text-[19px] text-ink-1">{title}</p>
        <p className="text-[14px] text-ink-4">{body}</p>
      </div>
    </div>
  )
}

export function SolutionsPanel({ handleQuery, languages }: { handleQuery: string; languages: LanguageOption[] }) {
  const [languageId, setLanguageId] = useState('')
  const [sort, setSort] = useState<SolutionSort>('time')
  const [selected, setSelected] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['solutions', handleQuery, languageId, sort],
    queryFn: () =>
      api.get<SolutionsData>(
        `/api/member/solutions?${handleQuery}&sort=${sort}${languageId ? `&languageId=${languageId}` : ''}`,
      ),
    // Đổi bộ lọc là một query mới; không giữ dữ liệu cũ thì cả bảng lẫn hai ô chọn biến
    // thành spinner mỗi lần đổi — người ta vừa chạm vào ô chọn mà nó biến mất.
    placeholderData: keepPreviousData,
  })
  // Chi tiết (kèm source) chỉ nạp khi chọn một bài — danh sách cố ý không mang source.
  const { data: peer, isLoading: peerLoading } = useQuery({
    queryKey: ['solution', selected, handleQuery],
    queryFn: () => api.get<PeerSolution>(`/api/member/solutions/${selected}?${handleQuery}`),
    enabled: selected !== null,
  })

  if (isLoading || !data) {
    return (
      <div className="p-4">
        <Spinner />
      </div>
    )
  }
  if (!data.canAccess) {
    return data.reason === 'contest_embargo' ? (
      <Closed
        title="Contest đang diễn ra"
        body={`Bài này đang nằm trong một contest. Lời giải của mọi người mở lại sau ${
          data.embargoUntil ? new Date(data.embargoUntil).toLocaleString('vi-VN') : 'khi contest kết thúc'
        }.`}
      />
    ) : (
      <Closed
        title="Giải được bài này rồi mới xem lời giải người khác"
        body="Nộp được lời giải Chấp nhận (AC) là mở — để lời giải của người khác không thành đáp án cho người chưa thử."
      />
    )
  }

  if (selected) {
    return peerLoading || !peer ? (
      <div className="p-4">
        <Spinner />
      </div>
    ) : (
      <CompareView mine={data.mine} peer={peer} languages={languages} onBack={() => setSelected(null)} />
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-4">
      {data.reference ? <ReferenceCard reference={data.reference} languages={languages} /> : null}

      <section>
        <SectionRule label="Lời giải của mọi người" meta={`${data.peers.length} người chia sẻ`} level={3} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 font-mono text-[12px] text-ink-5">
            Ngôn ngữ
            <select
              aria-label="Lọc ngôn ngữ"
              value={languageId}
              onChange={(e) => setLanguageId(e.target.value)}
              className="border border-line-strong bg-transparent px-2 py-1 text-[12px] text-ink-2"
            >
              <option value="">Tất cả</option>
              {languages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 font-mono text-[12px] text-ink-5">
            Xếp theo
            <select
              aria-label="Xếp theo"
              value={sort}
              onChange={(e) => setSort(e.target.value as SolutionSort)}
              className="border border-line-strong bg-transparent px-2 py-1 text-[12px] text-ink-2"
            >
              <option value="time">Thời gian</option>
              <option value="memory">Bộ nhớ</option>
              <option value="recent">Mới nhất</option>
            </select>
          </label>
        </div>
        <div className="mt-3">
          {data.peers.length === 0 ? (
            <EmptyState
              title="Chưa ai chia sẻ lời giải bài này"
              hint="Bài AC của bạn đang được chia sẻ cho người khác — tắt ở trang Tài khoản nếu không muốn."
            />
          ) : (
            <PeerList peers={data.peers} mine={data.mine} languages={languages} onSelect={setSelected} />
          )}
        </div>
      </section>
    </div>
  )
}
