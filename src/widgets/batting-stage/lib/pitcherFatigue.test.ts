import { describe, expect, it } from 'vitest'
import {
  MISTAKE_MARK_OFFSET_Y,
  pitcherFatigueAnimationOf,
  pitcherFatigueFrameAt,
  pitcherHomeRunMarksOf,
  pitchWindDrawCallOf,
  isHomeRunLikeResultCode,
  showsPitcherFatigue,
  showsPitcherMistakeMark,
} from '@/widgets/batting-stage/lib/pitcherFatigue'
import { judgeFrameAt, pitchStepAt } from '@/widgets/batting-stage/lib/stageScenery'

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

describe('투수 그리기의 홈런 갈래 (0x3908a~0x39192)', () => {
  const base = { resultCode: 25, isBigHit: true, pitcherTickAtHit: 30, pitcherTick: 30, step: 13, aceOrder: null }

  it('결과 코드 24~26 만 (0x357e0)', () => {
    expect([23, 24, 25, 26, 27, null].map(isHomeRunLikeResultCode)).toEqual([false, true, true, true, false, false])
    expect(pitcherHomeRunMarksOf({ ...base, resultCode: 27 })).toBeNull()
  })

  it('투수 단계가 마지막 단계(13 · 마투수 0xcfd34[순번])일 때만 — 첫 그림이 1', () => {
    expect(pitcherHomeRunMarksOf({ ...base, step: 12 })).toBeNull()
    expect(pitcherHomeRunMarksOf(base)).toEqual({ drawCall: 1, showsPitcherAnimation: true, showsBang: true })
    expect(pitcherHomeRunMarksOf({ ...base, pitcherTick: 34 })?.drawCall).toBe(5)
    // 마투수: 애니 12 는 안 그리고 "!" 만, 목표 단계는 0xcfd34[3] = 15
    expect(pitcherHomeRunMarksOf({ ...base, aceOrder: 3, step: 13 })).toBeNull()
    expect(pitcherHomeRunMarksOf({ ...base, aceOrder: 3, step: 15, pitcherTick: 60, pitcherTickAtHit: 60 })).toEqual({
      drawCall: 1,
      showsPitcherAnimation: false,
      showsBang: true,
    })
  })

  it('감상 플래그(+0x199a)가 없으면 "!" 는 안 그린다', () => {
    expect(pitcherHomeRunMarksOf({ ...base, isBigHit: false })?.showsBang).toBe(false)
  })

  it('0x13 에 들기 전 마지막 단계에 닿았으면 0x13 진입부터 센다', () => {
    // 평범한 투수의 단계 13 은 투수 틱 19 — 0x13 이 틱 25 에 들었으면 틱 25 가 첫 그림
    expect(pitcherHomeRunMarksOf({ ...base, pitcherTickAtHit: 25, pitcherTick: 25 })?.drawCall).toBe(1)
    expect(pitcherHomeRunMarksOf({ ...base, pitcherTickAtHit: 10, pitcherTick: 19 })?.drawCall).toBe(1)
  })
})

describe('투구 바람 줄 (0x38dc6~0x38e5e)', () => {
  // player_effect 애니 11 — animations.json 그대로
  const WIND = [
    { frame: 37, delay: 1 },
    { frame: 38, delay: 2 },
    { frame: 39, delay: 1 },
    { frame: 40, delay: 1 },
    { frame: 41, delay: 1 },
  ]
  const at = (pitcherTick: number, aceOrder: number | null = null) =>
    pitchWindDrawCallOf({ state: 1, step: pitchStepAt(pitcherTick, aceOrder), pitcherTick, aceOrder })

  it('평범한 투수 단계 7~11(투수 틱 12~17) 에서만 여섯 번 그린다', () => {
    const calls = Array.from({ length: 24 }, (_unused, tick) => at(tick))
    expect(calls.slice(0, 12).every((call) => call === null)).toBe(true)
    expect(calls.slice(12, 18)).toEqual([1, 2, 3, 4, 5, 6])
    expect(calls.slice(18).every((call) => call === null)).toBe(true)
  })

  it('k 번째 그림은 k 칸 나아간 칸 — 38 · 38 · 39 · 40 · 41 · 41 (첫 칸 37 은 안 보인다)', () => {
    expect([1, 2, 3, 4, 5, 6].map((call) => judgeFrameAt(WIND, call))).toEqual([38, 38, 39, 40, 41, 41])
  })

  it('상태 1 이 아니거나 마투수면 안 그린다 (38dc6 · 38dd4)', () => {
    expect(pitchWindDrawCallOf({ state: 0, step: 8, pitcherTick: 13, aceOrder: null })).toBeNull()
    expect(pitchWindDrawCallOf({ state: 2, step: 8, pitcherTick: 13, aceOrder: null })).toBeNull()
    expect(at(13, 0)).toBeNull()
  })
})
