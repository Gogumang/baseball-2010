import { describe, expect, it } from 'vitest'
import {
  INTRO_TICKS,
  hasGameIntro,
  introBandAlphaOf,
  introCounterAt,
  introFadeAt,
} from '@/widgets/game-scene/lib/introSchedule'

describe('경기 시작 인트로 (상태 0xc)', () => {
  it('270 → 0 을 5씩 — 진입 틀에도 갱신이 돌아 틱 t 의 그림은 270 − 5(t + 1), 54틱이면 끝난다 (0x52c50 · 0x39e3c)', () => {
    expect(INTRO_TICKS).toBe(54)
    expect(introCounterAt(0)).toBe(265)
    expect(introCounterAt(52)).toBe(5)
    expect(introCounterAt(53)).toBe(0)
    expect(introCounterAt(99)).toBe(0)
  })

  it('카운터 59 이하에서 알파 · +0x17e6 을 틱마다 앞 값에서 뺀다 (39e6c~39e8c)', () => {
    // 카운터 55 · 50 (틱 42 · 43) 은 k = 0
    expect(introFadeAt(41)).toEqual({ alpha: 255, level: 15 })
    expect(introFadeAt(43)).toEqual({ alpha: 255, level: 15 })
    // 45 · 40 · 35 → k 1, 30 · 25 · 20 → k 2, 15 · 10 · 5 → k 3, 0 → k 4
    expect([44, 45, 46, 47, 48, 49, 50, 51, 52, 53].map(introFadeAt)).toEqual([
      { alpha: 225, level: 13 },
      { alpha: 195, level: 11 },
      { alpha: 165, level: 9 },
      { alpha: 105, level: 5 },
      { alpha: 45, level: 1 },
      { alpha: 1, level: 0 },
      { alpha: 1, level: 0 },
      { alpha: 1, level: 0 },
      { alpha: 1, level: 0 },
      { alpha: 1, level: 0 },
    ])
    expect(introBandAlphaOf({ alpha: 255, level: 15 })).toBe(170)
    expect(introBandAlphaOf(introFadeAt(53))).toBe(1)
  })

  it('모드 1·2·3·4 만 인트로가 선다 — 대전(8·9)·홈런더비(7)는 없다 (0x48b20)', () => {
    expect([1, 2, 3, 4].every(hasGameIntro)).toBe(true)
    expect([5, 6, 7, 8, 9].some(hasGameIntro)).toBe(false)
  })
})
