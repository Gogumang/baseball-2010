import { describe, expect, it } from 'vitest'
import { pitcherFatigueAnimationOf, pitcherFatigueFrameAt, showsPitcherFatigue } from '@/widgets/batting-stage/lib/pitcherFatigue'

describe('마운드 투수 체력 그림 (0x38f42~0x39086)', () => {
  it('체력 ≤ 19 애니 10 · 20~34 애니 9 · 35 이상 없음', () => {
    expect([0, 19, 20, 34, 35, 100].map(pitcherFatigueAnimationOf)).toEqual([10, 10, 9, 9, null, null])
  })
  it('홈런더비 · 마투수 · 던지는 동작 중엔 안 그린다', () => {
    expect(showsPitcherFatigue({ gameMode: 1, isAcePitcher: false, isThrowing: false })).toBe(true)
    expect(showsPitcherFatigue({ gameMode: 7, isAcePitcher: false, isThrowing: false })).toBe(false)
    expect(showsPitcherFatigue({ gameMode: 3, isAcePitcher: true, isThrowing: false })).toBe(false)
    expect(showsPitcherFatigue({ gameMode: 3, isAcePitcher: false, isThrowing: true })).toBe(false)
  })
  it('k 번째 그림은 k 칸 나아간 칸 — 애니 10(2,3,2,2) 은 9 그림 주기', () => {
    const 표 = [{ frame: 46, delay: 2 }, { frame: 47, delay: 3 }, { frame: 48, delay: 2 }, { frame: 49, delay: 2 }]
    expect([1, 2, 5, 7, 9, 10].map((k) => pitcherFatigueFrameAt(표, k)?.frame)).toEqual([46, 47, 48, 49, 46, 46])
  })
})
