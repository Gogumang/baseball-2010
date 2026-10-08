import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import { introSkipsFirstBoard, rollHalfInningFielders } from '@/features/play-game/model/halfInningBoard'

describe('공수 교대 판 틱 0 의 야수 걸음 (0x3fac4)', () => {
  it('아홉 명(i = 8..0) × 넷 = 36 번 굴린다', () => {
    let count = 0
    const random: RandomPort = createFractionRandom(() => {
      count += 1
      return 0.5
    })
    rollHalfInningFielders(random)
    expect(count).toBe(36)
  })
})

describe('인트로 끝 0x39e3c 의 갈림', () => {
  it('모드 1 · 이닝/전체면 1회초 판을 건너뛴다', () => {
    expect(introSkipsFirstBoard(1, { kind: 1, value: 0 })).toBe(true)
    expect(introSkipsFirstBoard(1, { kind: 1, value: 1 })).toBe(false)
    expect(introSkipsFirstBoard(2, { kind: 1, value: 0 })).toBe(false)
  })
})
