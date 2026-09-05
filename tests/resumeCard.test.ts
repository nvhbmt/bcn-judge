/**
 * `pickUnfinished` — bài nào lên thẻ "Làm tiếp dở dang".
 *
 * Luật: bài mà LẦN NỘP MỚI NHẤT của nó không phải AC. Không phải "lần nộp non-AC
 * mới nhất nói chung" — đó là lỗi bản trước, và là đúng ca người dùng báo: nộp sai
 * rồi nộp đúng cùng một bài mà thẻ vẫn khoe "lần cuối sai".
 */
import { describe, expect, it } from 'vitest'
import { pickUnfinished } from '@/pages/home/recent'
import type { RecentRow } from '@/pages/home/recent'
import type { Verdict } from '@/types/api'

/** rows xếp mới-nhất-trước, đúng như server trả (ORDER BY seq DESC). */
function row(over: Partial<RecentRow> & { id: string }): RecentRow {
  return {
    verdict: 'WA',
    status: 'done',
    receivedAt: '2026-09-06T10:00:00Z',
    problemTitle: 'Bài X',
    itemId: 'item-x',
    courseId: 'course-1',
    contestId: null,
    contestProblemId: null,
    score: 0,
    ...over,
  }
}

describe('pickUnfinished — lần nộp MỚI NHẤT của bài quyết định', () => {
  it('ca người dùng báo: WA rồi AC cùng bài → KHÔNG hiện (lần cuối là AC)', () => {
    const rows = [
      row({ id: 's2', verdict: 'AC', score: 100 }), // mới nhất
      row({ id: 's1', verdict: 'WA' }),
    ]
    expect(pickUnfinished(rows)).toBeNull()
  })

  it('AC rồi WA cùng bài → CÓ hiện (lần cuối là WA — thật sự đang dở)', () => {
    const rows = [
      row({ id: 's2', verdict: 'WA' }), // mới nhất
      row({ id: 's1', verdict: 'AC', score: 100 }),
    ]
    expect(pickUnfinished(rows)?.row.id).toBe('s2')
  })

  it('bài A vừa AC (mới nhất toàn cục), bài B đang WA → hiện B, không phải A', () => {
    const rows = [
      row({ id: 'a2', itemId: 'A', verdict: 'AC', problemTitle: 'A', score: 100 }),
      row({ id: 'b1', itemId: 'B', verdict: 'WA', problemTitle: 'B' }),
      row({ id: 'a1', itemId: 'A', verdict: 'WA', problemTitle: 'A' }),
    ]
    expect(pickUnfinished(rows)?.row.problemTitle).toBe('B')
  })

  it('cùng đề nhưng khác NGỮ CẢNH (contest vs khoá) không gộp làm một bài', () => {
    // Bài trong contest vừa AC; cùng đề đó trong khoá đang WA → khoá vẫn phải hiện.
    const rows = [
      row({ id: 'c1', itemId: null, courseId: null, contestId: 'ct', contestProblemId: 'cp', verdict: 'AC', score: 100 }),
      row({ id: 'k1', itemId: 'item-x', courseId: 'course-1', verdict: 'WA' }),
    ]
    expect(pickUnfinished(rows)?.row.id).toBe('k1')
  })

  it('nhiều bài cùng dở → bài có lần nộp MỚI NHẤT thắng (không phải nặng verdict/cũ nhất)', () => {
    const rows = [
      row({ id: 'b1', itemId: 'B', problemTitle: 'B', verdict: 'WA' }), // mới nhất trong các bài dở
      row({ id: 'a1', itemId: 'A', problemTitle: 'A', verdict: 'TLE' }), // cũ hơn, verdict "nặng" hơn
    ]
    expect(pickUnfinished(rows)?.row.problemTitle).toBe('B')
  })

  it('dựng ĐÚNG href: bài khoá về /khoa-hoc, bài contest về /contest', () => {
    const khoa = pickUnfinished([row({ id: 'k', itemId: 'it', courseId: 'co', verdict: 'WA' })])
    expect(khoa?.href).toBe('/khoa-hoc/co/bai/it')
    const ct = pickUnfinished([
      row({ id: 'c', itemId: null, courseId: null, contestId: 'ct', contestProblemId: 'cp', verdict: 'WA' }),
    ])
    expect(ct?.href).toBe('/contest/ct/bai/cp')
  })

  it('dòng dị dạng chỉ có contestId: [AC, WA] gộp theo contestId → không báo dở nhầm', () => {
    // Lỗi gốc sẽ quay lại nếu khoá rơi thẳng xuống `id`. Bậc contestId chặn điều đó.
    const rows = [
      row({ id: 's2', itemId: null, courseId: null, contestId: 'ct', contestProblemId: null, verdict: 'AC', score: 100 }),
      row({ id: 's1', itemId: null, courseId: null, contestId: 'ct', contestProblemId: null, verdict: 'WA' }),
    ]
    expect(pickUnfinished(rows)).toBeNull()
  })

  it('ba lần nộp cùng bài che nhau: [AC, WA, WA] → null; [WA, WA, AC] cũng theo lần đầu', () => {
    expect(
      pickUnfinished([
        row({ id: '3', verdict: 'AC', score: 100 }),
        row({ id: '2', verdict: 'WA' }),
        row({ id: '1', verdict: 'WA' }),
      ]),
    ).toBeNull()
    expect(
      pickUnfinished([
        row({ id: '3', verdict: 'WA' }),
        row({ id: '2', verdict: 'WA' }),
        row({ id: '1', verdict: 'AC', score: 100 }),
      ])?.row.id,
    ).toBe('3')
  })

  it('mảng rỗng và một dòng AC duy nhất đều không hiện thẻ', () => {
    expect(pickUnfinished([])).toBeNull()
    expect(pickUnfinished([row({ id: 's', verdict: 'AC', score: 100 })])).toBeNull()
  })

  it('lần mới nhất chưa chấm xong (status ≠ done) thì bỏ qua, không đoán bừa', () => {
    const rows = [
      row({ id: 's2', status: 'judging', verdict: null }),
      row({ id: 's1', verdict: 'WA' }),
    ]
    // s2 là lần mới nhất của bài nhưng chưa xong → không kết luận "dở"; và s1 bị
    // che sau s2 (cùng bài) nên cũng không vớ. Thẻ không hiện.
    expect(pickUnfinished(rows)).toBeNull()
  })

  it('non-AC nhưng không dựng được link thì bỏ qua — nút không dẫn đi đâu', () => {
    const rows = [row({ id: 's1', verdict: 'WA', itemId: null, courseId: null, contestId: null })]
    expect(pickUnfinished(rows)).toBeNull()
  })

  it('mọi verdict non-AC đều là "dở", kể cả CE/RE/TLE', () => {
    for (const v of ['WA', 'TLE', 'MLE', 'RE', 'CE'] as Verdict[]) {
      expect(pickUnfinished([row({ id: 's1', verdict: v })])?.row.verdict).toBe(v)
    }
  })
})
