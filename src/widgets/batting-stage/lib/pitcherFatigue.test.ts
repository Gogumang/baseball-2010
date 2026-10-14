import { describe, expect, it } from 'vitest'
import {
  MISTAKE_MARK_OFFSET_Y,
  pitcherFatigueAnimationOf,
  pitcherFatigueFrameAt,
  showsPitcherFatigue,
  showsPitcherMistakeMark,
} from '@/widgets/batting-stage/lib/pitcherFatigue'

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

describe('실투 "!" (0x38d1c 38ee0~38f3e)', () => {
  it('실투로 놓은 그림부터 네 번만 — 4deae +8 = 4, 그림마다 1 줄임', () => {
    expect([null, 0, 1, 2, 3, 4, 5].map((k) => showsPitcherMistakeMark(4, k))).toEqual([false, false, true, true, true, true, false])
  })
  it('홈런더비(모드 7)는 38ed6 에서 건너뛴다 · 미션 · 타자편은 그린다', () => {
    expect(showsPitcherMistakeMark(7, 1)).toBe(false)
    expect(showsPitcherMistakeMark(6, 1)).toBe(true)
  })
  it('투수 y 위 0x34 · 애니 13(지연 0 네 칸)은 k 번째 그림이 k 칸 나아간 칸', () => {
    expect(MISTAKE_MARK_OFFSET_Y).toBe(-52)
    const 표 = [0, 2, -1, -2].map((dy) => ({ frame: 50, delay: 0, dx: 0, dy }))
    expect([1, 2, 3, 4].map((k) => pitcherFatigueFrameAt(표, k)?.dy)).toEqual([2, -1, -2, 0])
  })
})
