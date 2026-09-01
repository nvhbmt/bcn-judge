/**
 * Đánh thức worker ngay khi có việc mới, thay vì để nó ngủ hết một nhịp poll.
 *
 * Trước đây `slotLoop` rảnh thì `sleep(1000)`. Đo trên máy: chấm xong một bài C bốn
 * testcase mất ~620 ms, mà chỉ riêng việc CHỜ ĐƯỢC NHẶT LÊN đã tốn trung bình ~500 ms
 * khi hệ thống vắng — tức gần một nửa thời gian người học ngồi nhìn màn hình là hàng
 * đợi đứng yên, không phải máy đang bận. Và "vắng" chính là trạng thái thường ngày của
 * một judge CLB: cả buổi chỉ vài chục lượt nộp.
 *
 * Dùng lại LISTEN/NOTIFY sẵn có (`realtime/bus`) chứ không thêm hạ tầng: API và worker
 * là hai tiến trình khác nhau nên tín hiệu bắt buộc phải đi qua Postgres.
 *
 * NHỊP POLL VẪN GIỮ NGUYÊN làm lưới an toàn. Chuông có thể mất — bus rớt kết nối, hoặc
 * NOTIFY phát trước lúc worker kịp LISTEN. Mất chuông thì chỉ chậm lại đúng bằng mức
 * cũ; bỏ poll đi thì mất chuông là việc nằm im vĩnh viễn. Đây là tối ưu độ trễ, không
 * phải cơ chế phân phối việc.
 */

/** Kênh logic trong envelope của bus (bus chỉ có một kênh Postgres duy nhất). */
export const JOB_CHANNEL = 'judge.job'

let waiters: (() => void)[] = []

/** Đánh thức mọi slot đang chờ. Gọi khi NOTIFY tới, hoặc khi worker tự biết còn việc. */
export function wakeAll(): void {
  const pending = waiters
  waiters = []
  for (const w of pending) w()
}

/**
 * Báo có việc mới. Không bao giờ ném: chuông hỏng thì hàng đợi vẫn chạy bằng poll, nên
 * một lỗi ở đây không được phép làm hỏng lượt nộp vừa ghi thành công.
 */
export async function signalJobReady(): Promise<void> {
  try {
    const { publish } = await import('../realtime/bus')
    await publish(JOB_CHANNEL, { kind: 'job.ready' })
  } catch {
    /* im lặng — poll sẽ nhặt */
  }
}

/** Nối bus và lắng nghe chuông. Không ném: nối hụt thì worker chạy như cũ. */
export async function startJobWake(): Promise<() => void> {
  try {
    const { startBus, subscribe } = await import('../realtime/bus')
    await startBus()
    return subscribe(JOB_CHANNEL, () => wakeAll())
  } catch {
    return () => {}
  }
}

/** Chờ tới khi có chuông HOẶC hết `timeoutMs` — cái nào tới trước. */
export function waitForJob(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(finish, timeoutMs)
    // `unref` để một slot đang chờ không giữ process sống khi tắt máy.
    timer.unref?.()
    waiters.push(finish)
  })
}
