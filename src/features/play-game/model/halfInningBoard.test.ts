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

  it('칸 i 의 네 값을 돌려준다 — 굴림 차례는 i = 8 → 0, 칸마다 공격 걸음 · x · z · 수비 걸음', () => {
    const asked: [number, number][] = []
    const random = {
      rand: (lo: number, hi: number) => {
        asked.push([lo, hi])
        return lo + asked.length
      },
    } as unknown as RandomPort
    const rolls = rollHalfInningFielders(random)
    // 칸 8 이 먼저 — i > 5 라 빠른 걸음 rand(300, 400)
    expect(asked.slice(0, 4)).toEqual([
      [300, 400],
      [0, 200],
      [100, 300],
      [300, 400],
    ])
    expect(rolls[8]).toEqual({ offenseSpeed: 301, scatterX: 2, scatterZ: 103, fielderSpeed: 304 })
    // 칸 5 부터 느린 걸음 rand(160, 240)
    expect(asked[12]).toEqual([160, 240])
    expect(rolls[0]).toEqual({ offenseSpeed: 160 + 33, scatterX: 34, scatterZ: 100 + 35, fielderSpeed: 160 + 36 })
  })
})

describe('인트로 끝 0x39e3c 의 갈림', () => {
  it('모드 1 · 이닝/전체면 1회초 판을 건너뛴다', () => {
    expect(introSkipsFirstBoard(1, { kind: 1, value: 0 })).toBe(true)
    expect(introSkipsFirstBoard(1, { kind: 1, value: 1 })).toBe(false)
    expect(introSkipsFirstBoard(2, { kind: 1, value: 0 })).toBe(false)
  })
})
