/**
 * Dọn container sandbox mồ côi lúc worker khởi động.
 *
 * Trước đây chưa có bộ dọn nào: worker bị SIGKILL giữa lúc chấm là container đó nằm
 * lại mãi. Chuyện đó vốn hiếm (mỗi lần chết cùng lắm bỏ lại `workerSlots` container),
 * nhưng pool ấm làm nó thành vấn đề thật — nay lúc nào cũng có sẵn container nhàn rỗi,
 * nên mỗi lần khởi động lại bỏ thêm một lứa, và số đó cộng dồn qua từng lần deploy.
 *
 * Luật dọn phải sống được với blue-green (ADR-11): trong lúc deploy có HAI worker cùng
 * chạy trên một host, nên "xoá mọi container sandbox lúc khởi động" sẽ giết ngang bài
 * đang chấm của worker kia. Vì vậy dọn theo CHỦ SỞ HỮU: mỗi container mang nhãn
 * `bcnjudge.worker`, và chỉ xoá container có chủ đã chết — chết nghĩa là không còn
 * dòng nào trong bảng `workers` báo hiệu trong 30 giây gần đây, đúng ngưỡng mà trang
 * quản trị dùng để nói một worker còn sống.
 *
 * Container không mang nhãn chủ thì không đụng tới: nó không phải của cơ chế này, và
 * đoán mò ở đây có giá là giết nhầm việc đang chạy.
 */
import { sql } from 'drizzle-orm'
import { q } from '../db/pool'
import { docker } from './sandbox'

export interface ReapResult {
  removed: number
  kept: number
}

export async function reapOrphanSandboxes(selfWorkerId: string): Promise<ReapResult> {
  const containers = await docker.listContainers({
    all: true,
    filters: { label: ['bcnjudge.sandbox=1'] },
  })
  if (containers.length === 0) return { removed: 0, kept: 0 }

  const alive = new Set(
    (
      await q<{ id: string }>(sql`
        SELECT id FROM workers WHERE last_seen_at > now() - interval '30 seconds'
      `)
    ).map((r) => r.id),
  )
  alive.add(selfWorkerId)

  let removed = 0
  let kept = 0
  for (const c of containers) {
    const owner = c.Labels?.['bcnjudge.worker']
    // Không rõ chủ → để yên. Thà bỏ sót một container rác còn hơn giết nhầm một lượt
    // chấm đang chạy của tiến trình khác.
    if (!owner || alive.has(owner)) {
      kept++
      continue
    }
    try {
      await docker.getContainer(c.Id).remove({ force: true })
      removed++
    } catch {
      /* Đã biến mất, hoặc ai đó dọn trước — không phải lỗi. */
    }
  }
  return { removed, kept }
}
