/** Xuất bản contest (FR-I2) — cùng luật cổng mềm/cứng với xuất bản mục (FR-D6). */
import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button, SectionRule } from '@/components/ui'
import { PublishGateNotice } from './PublishGateNotice'
import { Notice } from './fields'
import type { PublishStatus } from './mentorTypes'
import { readPublishGate, type PublishGate } from './publishGate'
import { useContestMutations } from './useContests'

export function ContestPublishPanel({ contestId, status }: { contestId: string; status: PublishStatus }) {
  const { publish } = useContestMutations()
  const [gate, setGate] = useState<PublishGate | null>(null)

  function doPublish(confirm?: boolean) {
    // Gửi thẳng rồi để server phán; readPublishGate mới quyết có nút "Vẫn xuất bản"
    // hay không, dựa trên mã lỗi chứ không đoán trước ở FE.
    publish.mutate({ id: contestId, ...(confirm ? { confirm } : {}) }, {
      onSuccess: () => setGate(null),
      onError: (err) => setGate(readPublishGate(err)),
    })
  }

  return (
    <section className="border border-line bg-surface-2 p-4">
      <div className="mb-1"><SectionRule label="Xuất bản" /></div>
      <p className="mb-3 text-sm text-ink-5">
        Contest Nháp chưa member nào thấy. Xuất bản rồi thì member trong phạm vi thấy nó ở mục
        “Sắp diễn ra” kèm đếm ngược, nhưng chưa thấy đề trước giờ bắt đầu.
      </p>

      {status === 'published' ? (
        <Notice tone="ok">Contest đã xuất bản.</Notice>
      ) : (
        <Button variant="primary" onClick={() => doPublish()} disabled={publish.isPending}>
          <Send size={15} /> {publish.isPending ? 'Đang xuất bản…' : 'Xuất bản contest'}
        </Button>
      )}

      {gate ? (
        <PublishGateNotice
          gate={gate}
          pending={publish.isPending}
          onConfirm={() => doPublish(true)}
          onDismiss={() => setGate(null)}
        />
      ) : null}
    </section>
  )
}
