/**
 * Chuẩn hoá hai dạng server (cá nhân / team) về một hàng chung `LbEntry`.
 * Chốt: team mang `meta` số người và lấy `isMine`; cá nhân `meta`=null, lấy `isMe`.
 */
import { describe, expect, it } from 'vitest'
import { toEntries, type IndividualRow, type TeamRow } from '@/pages/leaderboard/types'

describe('toEntries', () => {
  it('cá nhân: giữ tên/điểm, meta null, cờ isMe', () => {
    const rows: IndividualRow[] = [
      { rank: 1, userId: 'u1', displayName: 'An', acCount: 5, totalPoints: 500, isMe: true },
    ]
    expect(toEntries('individual', rows)).toEqual([
      { rank: 1, key: 'u1', name: 'An', acCount: 5, totalPoints: 500, practicePoints: null, contestPoints: null, meta: null, isMe: true },
    ])
  })

  it('team: meta "N người", key=id, cờ lấy từ isMine', () => {
    const rows: TeamRow[] = [
      { rank: 2, id: 't1', name: 'Alpha', acCount: 12, totalPoints: 1200, memberCount: 4, isMine: true },
    ]
    expect(toEntries('team', rows)).toEqual([
      { rank: 2, key: 't1', name: 'Alpha', acCount: 12, totalPoints: 1200, practicePoints: null, contestPoints: null, meta: '4 người', isMe: true },
    ])
  })

  it('server tách hai vế thì giữ lại cho bảng Tổng hợp', () => {
    const rows: IndividualRow[] = [
      { rank: 1, userId: 'u1', displayName: 'An', acCount: 5, totalPoints: 800, practicePoints: 500, contestPoints: 300, isMe: false },
    ]
    expect(toEntries('individual', rows)[0]).toMatchObject({ practicePoints: 500, contestPoints: 300 })
  })
})
