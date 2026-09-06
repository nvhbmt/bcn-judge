/**
 * Huy chương hạng 1-2-3: chỉ ba hạng đầu có, còn lại không (để bảng rơi về số).
 */
import { describe, expect, it } from 'vitest'
import { medal } from '@/lib/medal'

describe('medal', () => {
  it('vàng/bạc/đồng cho 1/2/3', () => {
    expect(medal(1)).toBe('🥇')
    expect(medal(2)).toBe('🥈')
    expect(medal(3)).toBe('🥉')
  })
  it('hạng 4 trở đi và giá trị lạ → null', () => {
    expect(medal(4)).toBeNull()
    expect(medal(0)).toBeNull()
    expect(medal(100)).toBeNull()
  })
})
